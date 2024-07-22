const express = require("express");
const axios = require("axios");
const fs = require("fs");
const moment = require("moment-timezone");
const http = require("http");
const socketIo = require("socket.io");
const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const processedEvents = new Set();
const path = "orderDetails.json";
const processedEventsPath = "processedEvents.json";
const authToken = "[AuthToken]";
const client = require("twilio")(accountSid, authToken);

let serverLogs = [];

function logToServer(message) {
    serverLogs.push(message);
    console.log(message);
}

const initializeProcessedEvents = async () => {
    try {
        if (!fs.existsSync(processedEventsPath)) {
            await fs.promises.writeFile(
                processedEventsPath,
                JSON.stringify([]),
                "utf8",
            );
            logToServer("Initialized processedEvents.json file");
        }
        const data = await fs.promises.readFile(processedEventsPath, "utf8");
        const eventIds = JSON.parse(data);
        eventIds.forEach((id) => processedEvents.add(id));
        logToServer("Loaded processed events");
    } catch (error) {
        logToServer(
            "Failed to initialize or load processedEvents.json file:",
            error,
        );
    }
};

initializeProcessedEvents();

app.use(express.json());
app.use(express.static("public"));
app.set("view engine", "ejs");

app.get("/", (req, res) => {
    fs.readFile(path, "utf8", (err, data) => {
        if (err) {
            console.error("Error reading order details file:", err);
            logToServer("Error reading order details file:", err);
            return res.render("index", { orders: [] });
        }
        let orders = JSON.parse(data || "[]");
        orders = orders.map((order) => ({
            ...order,
            ticketName: censorLastName(order.ticketName),
        }));
        res.render("index", { orders });
    });
});

app.get("/adminLogin", (req, res) => {
    res.render("adminLogin");
});

app.get("/admin", async (req, res) => {
    try {
        const orders = await readOrders();
        const updatedOrders = orders.map((order) => ({
            ...order,
            ticketName: censorLastName(order.ticketName),
        }));
        res.render("admin", { serverLogs, orders: updatedOrders });
    } catch (error) {
        console.error("Error loading orders for admin view:", error);
        logToServer("Error loading orders for admin view:", error);
        res.render("admin", { serverLogs, orders: [] });
    }
});

app.post("/webhooks/square", async (req, res) => {
    const eventId = req.body.event_id;
    const paymentData = req.body.data.object.payment;

    res.status(200).send("Received");

    if (processedEvents.has(eventId) || req.body.type !== "payment.created") {
        return;
    }

    const eventTime = moment(paymentData.created_at);
    const currentTime = moment();
    if (currentTime.diff(eventTime, "hours") > .2) {
        logToServer(`Skipping old event: ${eventId}`);
        return;
    }

    if (paymentData.order_id) {
        try {
            await retrieveAndStoreOrderDetails(paymentData.order_id);
            processedEvents.add(eventId);
            await saveProcessedEvent(eventId);
            const orders = await readOrders();
            const updatedOrders = orders.map((order) => ({
                ...order,
                ticketName: censorLastName(order.ticketName),
            }));
            io.emit("orders-updated", updatedOrders);
        } catch (error) {
            logToServer("Error during order retrieval or storage:", error);
        }
    }
});

app.post("/webhooks/fresh-kds", async (req, res) => {
    const kdsOrder = req.body.kdsOrder;

    const cleanName = kdsOrder.name.replace(/\s+\(.*?\)/, "").trim();
    console.log(`Processing KDS webhook for cleaned ticket name: ${cleanName}`);

    try {
        let orders = await readOrders();
        console.log(`Read ${orders.length} orders from storage`);

        let orderFound = false;
        let updatedOrders = orders.map((order) => {
            if (order.ticketName.trim() === cleanName) {
                console.log(
                    `Matching order found: ${order.ticketName} with status ${order.status} and bump count ${order.bumpCount}`,
                );
                orderFound = true;
                order.bumpCount = (order.bumpCount || 0) + 1;
                console.log(`Bump count incremented to: ${order.bumpCount}`);

                if (order.status === "pending" && order.bumpCount === 1) {
                    order.status = "in the oven";
                    console.log(
                        `Order status updated to 'in the oven' for: ${order.ticketName}`,
                    );
                    sendSMS(
                        order.customerPhone,
                        `Your order is now in the oven: ${order.ticketName}`,
                    );
                } else if (
                    order.status === "in the oven" &&
                    order.bumpCount === 2
                ) {
                    order.status = "ready for pickup";
                    order.readyTime = new Date().toISOString();
                    console.log(
                        `Order status updated to 'ready for pickup' for: ${order.ticketName}`,
                    );
                    sendSMS(
                        order.customerPhone,
                        `Your order is ready for pickup: ${order.ticketName}`,
                    );
                }
            }
            return order;
        });

        if (!orderFound) {
            console.log(`No matching order found for ticketName: ${cleanName}`);
            logToServer(`No matching order found for ticketName: ${cleanName}`);
        }

        await saveOrders(updatedOrders);
        console.log("Orders saved successfully after KDS event");
        io.emit("orders-updated", updatedOrders);
    } catch (error) {
        console.error("Error processing webhook for FRESH KDS:", error);
        logToServer(`Error processing webhook for FRESH KDS: ${error}`);
        return res.status(500).send("Error processing webhook");
    }

    res.status(200).send("Webhook received");
});

app.post("/delete-json", async (req, res) => {
    try {
        await fs.promises.writeFile(path, JSON.stringify([]), "utf8");
        console.log("Emptied orderDetails.json file");
        res.status(200).json({ message: "Emptied orderDetails.json file" });
    } catch (error) {
        console.error("Failed to empty orderDetails.json file:", error);
        res.status(500).json({
            message: "Failed to empty orderDetails.json file",
        });
    }
});

app.delete("/delete-order/:id", async (req, res) => {
    const orderId = parseInt(req.params.id, 10);
    try {
        let orders = await readOrders();
        orders = orders.filter((order, index) => index !== orderId);
        await saveOrders(orders);
        io.emit("orders-updated", orders);
        res.status(200).json({ message: "Order deleted successfully" });
    } catch (error) {
        console.error("Error deleting order:", error);
        logToServer("Error deleting order:", error);
        res.status(500).json({ message: "Error deleting order" });
    }
});

async function sendSMS(phoneNumber, message) {
    if (!phoneNumber) {
        console.log("No phone number available for SMS");
        return;
    }
    try {
        await client.messages.create({
            to: phoneNumber,
            from: process.env.TWILIO_PHONE_NUMBER,
            body: message,
        });
        console.log(`SMS sent to ${phoneNumber}: ${message}`);
    } catch (error) {
        console.error(`Failed to send SMS to ${phoneNumber}:`, error);
    }
}

const exponentialBackoff = async (fn, retries = 5, delay = 1000) => {
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (error) {
            if (i === retries - 1) throw error;
            await new Promise((resolve) => setTimeout(resolve, delay));
            delay *= 2; 
        }
    }
};

const excludedItems = ["Drink Pop", "Drink Water", "Card Fee", "ADD Extra Cups Of Marinara"]; 

const retrieveAndStoreOrderDetails = async (orderId) => {
    const url = `https://connect.squareup.com/v2/orders/${orderId}`;
    const config = {
        headers: {
            "Square-Version": "2023-04-20",
            Authorization: `Bearer ${process.env.API_KEY}`,
            "Content-Type": "application/json",
        },
    };

    const fetchOrderDetails = async () => {
        const response = await axios.get(url, config);
        return response.data.order;
    };

    try {
        const order = await exponentialBackoff(fetchOrderDetails);

        const createdAtEST = moment(order.created_at)
            .tz("America/New_York")
            .format("h:mm A");

        const items = order.line_items
            .filter(item => !excludedItems.includes(item.name))
            .map((item) => `${item.name} x${item.quantity}`)
            .join(", ");

        const ticketName = order.ticket_name || "No Ticket Name";
        const newOrderDetails = {
            ticketName,
            createdAtEST,
            items,
            status: "pending",
        };

        let existingOrders = await readOrders();
        existingOrders.push(newOrderDetails);
        await saveOrders(existingOrders);

        io.emit("orders-updated", existingOrders);
        console.log("Saved new order details:", newOrderDetails);
        logToServer("Saved new order details:", newOrderDetails);
    } catch (error) {
        console.error("Error retrieving or saving order details:", error);
        logToServer("Error retrieving or saving order details:", error);
    }
};

async function readOrders() {
    try {
        const data = await fs.promises.readFile(path, "utf8");
        return JSON.parse(data);
    } catch (error) {
        console.error("Failed to read orders file:", error);
        logToServer("Failed to read orders file:", error);
        return [];
    }
}

async function saveOrders(orders) {
    try {
        await fs.promises.writeFile(
            path,
            JSON.stringify(orders, null, 4),
            "utf8",
        );
    } catch (error) {
        console.error("Failed to save orders file:", error);
        logToServer("Failed to save orders file:", error);
    }
}

async function saveProcessedEvent(eventId) {
    try {
        let eventIds = [];
        if (fs.existsSync(processedEventsPath)) {
            const data = await fs.promises.readFile(
                processedEventsPath,
                "utf8",
            );
            eventIds = JSON.parse(data);
        }
        eventIds.push(eventId);
        await fs.promises.writeFile(
            processedEventsPath,
            JSON.stringify(eventIds, null, 4),
            "utf8",
        );
        console.log(`Processed event ID ${eventId} saved`);
        logToServer(`Processed event ID ${eventId} saved`);
    } catch (error) {
        console.error("Failed to save processed event ID:", error);
        logToServer("Failed to save processed event ID:", error);
    }
}

async function cleanupOldOrders() {
    let orders = await readOrders();
    const currentTime = Date.now();
    const fiveMinutes = 300000;

    orders = orders.filter((order) => {
        if (order.status === "ready for pickup" && order.readyTime) {
            return (
                currentTime - new Date(order.readyTime).getTime() < fiveMinutes
            );
        }
        return true;
    });

    await saveOrders(orders);
}

setInterval(cleanupOldOrders, 60000);

app.post("/update-order-status", async (req, res) => {
    const { orderId, status } = req.body;
    let orders = await readOrders();
    orders = orders.map((order) => {
        if (order.id === orderId && status === "ready for pickup") {
            order.status = "ready for pickup";
            order.readyTime = new Date().toISOString();
        }
        return order;
    });

    await saveOrders(orders);
    res.send({ message: "Order updated" });
});

const censorLastName = (fullName) => {
    const nameParts = fullName.trim().split(" ");
    if (nameParts.length < 2) {
        return fullName;
    }
    const firstName = nameParts.slice(0, -1).join(" ");
    const lastName = nameParts[nameParts.length - 1];
    const censoredLastName =
        lastName.charAt(0) + "*".repeat(lastName.length - 1);
    return `${firstName} ${censoredLastName}`;
};

server.listen(3000, () => {
    console.log("Server running on port 3000");
    logToServer("Server running on port 3000");
});
