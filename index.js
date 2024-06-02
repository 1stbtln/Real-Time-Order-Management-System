const express = require("express");
const axios = require("axios");
const fs = require("fs");
const moment = require("moment-timezone");
const app = express();
const http = require("http");
const socketIo = require("socket.io");
const server = http.createServer(app);
const io = socketIo(server);
const processedEvents = new Set();
const path = 'orderDetails.json';

app.use(express.json());
app.use(express.static("public"));
app.set("view engine", "ejs");

app.get("/", (req, res) => {
    fs.readFile("orderDetails.json", "utf8", (err, data) => {
        if (err) {
            console.error("Error reading file:", err);
            return res.render("index", { orders: [] });
        }
        let orders = JSON.parse(data || "[]");
        console.log("Current orders loaded:", JSON.stringify(orders, null, 2));
        res.render("index", { orders });
    });
});

app.post("/webhooks/square", async (req, res) => {
    const eventId = req.body.event_id;
    const paymentData = req.body.data.object.payment;

    res.status(200).send("Received");

    if (processedEvents.has(eventId) || req.body.type !== "payment.created") {
        return;
    }

    if (paymentData.order_id) {
        console.log(
            `Processing order_id: ${paymentData.order_id}, created_at: ${paymentData.created_at}`,
        );
        try {
            await retrieveAndStoreOrderDetails(paymentData.order_id);
            processedEvents.add(eventId);
            const orders = await readOrders();
            console.log(
                "Emitting updated orders after payment:",
                JSON.stringify(orders, null, 2),
            );
            io.emit("orders-updated", orders);
        } catch (error) {
            console.error("Error during order retrieval or storage:", error);
        }
    }
});

app.post("/webhooks/fhresh-kids", async (req, res) => {
    const kdsOrder = req.body.kdsOrder;
    console.log(
        `Received KDS webhook for order: ${kdsOrder.orderId} with name: ${kdsOrder.name}`,
    );

    const cleanName = kdsOrder.name.replace(/\s+\(.*?\)/, "").trim();

    let orders = await readOrders();
    let orderFound = false;
    orders = orders.map((order) => {
        if (order.ticketName.trim() === cleanName) {
            orderFound = true;
            if (order.status === "pending") {
                return { ...order, status: "in the oven" };
            } else if (order.status === "in the oven") {
                return { ...order, status: "ready for pickup", readyTime: new Date().toISOString() }; // Add readyTime
            }
            return order;
        }
        return order;
    });

    if (!orderFound) {
        console.log(`No matching order found for ticketName: ${cleanName}`);
    }

    await fs.promises.writeFile(
        "orderDetails.json",
        JSON.stringify(orders, null, 4),
        "utf8",
    );
    console.log(
        "Updated orders after KDS event:",
        JSON.stringify(orders, null, 2),
    );

    res.status(200).send("Webhook received");

    io.emit("order-update", { name: cleanName, orderId: kdsOrder.orderId });
    io.emit("orders-updated", orders);
});

const retrieveAndStoreOrderDetails = async (orderId) => {
    const url = `https://connect.squareup.com/v2/orders/${orderId}`;
    const config = {
        headers: {
            "Square-Version": "2023-04-20",
            Authorization: `Bearer ${process.env.API_KEY}`, 
            "Content-Type": "application/json",
        },
    };

    try {
        const response = await axios.get(url, config);
        const order = response.data.order;
        console.log(
            "Retrieved order details from Square:",
            JSON.stringify(order, null, 2),
        );
        const createdAtEST = moment(order.created_at)
            .tz("America/New_York")
            .format("hh:mm A");
        const items = order.line_items
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
        await fs.promises.writeFile(
            "orderDetails.json",
            JSON.stringify(existingOrders, null, 4),
            "utf8",
        );
        console.log(
            "Saved new order details:",
            JSON.stringify(newOrderDetails, null, 2),
        );

        io.emit("orders-updated", existingOrders);
    } catch (error) {
        console.error("Error retrieving or saving order details:", error);
        throw error;
    }
};

async function readOrders() {
    try {
        const data = await fs.promises.readFile(path, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error("Failed to read orders file:", error);
        return [];
    }
}

async function saveOrders(orders) {
    try {
        await fs.promises.writeFile(path, JSON.stringify(orders, null, 4), 'utf8');
    } catch (error) {
        console.error("Failed to save orders file:", error);
    }
}

async function cleanupOldOrders() {
    let orders = await readOrders();
    const currentTime = Date.now();
    const fiveMinutes = 300000; 

    orders = orders.filter(order => {
        if (order.status === 'ready for pickup' && order.readyTime) {
            return (currentTime - new Date(order.readyTime).getTime()) < fiveMinutes;
        }
        return true;
    });

    await saveOrders(orders);
}

setInterval(cleanupOldOrders, 60000);

app.post("/update-order-status", async (req, res) => {
    const { orderId, status } = req.body;
    let orders = await readOrders();
    orders = orders.map(order => {
        if (order.id === orderId && status === 'ready for pickup') {
            order.status = 'ready for pickup';
            order.readyTime = new Date().toISOString(); 
        }
        return order;
    });

    await saveOrders(orders);
    res.send({ message: 'Order updated' });
});

server.listen(3000, () => {
    console.log("Server running on port 3000");
});
