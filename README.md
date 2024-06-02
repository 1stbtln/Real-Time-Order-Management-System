A real-time order management system using Node.js, Express, Socket.io, and EJS. This application integrates with Square's API for payment processing and a custom Kitchen Display System (KDS) webhook to update order statuses dynamically. It includes features for handling real-time updates, infinite scrolling for large order lists, and automated cleanup of old orders.

Repository Files:
index.js - Main server file.
public/ - Static files such as CSS and JavaScript.
views/ - EJS templates for rendering HTML.
orderDetails.json - JSON file storing order details.
README.md:
markdown
Copy code
# Real-Time Order Management System

This is a real-time order management system built with Node.js, Express, Socket.io, and EJS. It integrates with Square's API for payment processing and a custom Kitchen Display System (KDS) webhook to update order statuses dynamically.

## Features

- **Real-Time Updates**: Uses Socket.io for real-time updates to the front-end.
- **Square Integration**: Integrates with Square's API to handle payment events.
- **KDS Integration**: Receives and processes webhooks from a custom KDS.
- **Order Management**: Automatically updates order statuses and cleans up old orders.
- **Infinite Scrolling**: Implements infinite scrolling for "ready for pickup" orders when there are more than 7 orders.

## Installation

1. **Clone the repository**:
    ```bash
    git clone https://github.com/your-username/real-time-order-management-system.git
    cd real-time-order-management-system
    ```

2. **Install dependencies**:
    ```bash
    npm install
    ```

3. **Set up environment variables**:
    Create a `.env` file in the root directory and add your Square API key:
    ```env
    SQUARE_API_KEY=API_KEY
    ```

4. **Run the server**:
    ```bash
    npm start
    ```

5. **Open your browser**:
    Visit `http://localhost:3000` to view the application.

## Usage

- **Square Webhooks**: The server listens for Square webhook events at `/webhooks/square`.
- **KDS Webhooks**: The server listens for KDS webhook events at `/webhooks/fhresh-kids`.
- **Order Status Update**: To update the status of an order, send a POST request to `/update-order-status` with the order ID and new status.

## File Structure

.
├── public
│ ├── css
│ │ └── style.css
│ └── js
│ └── script.js
├── views
│ └── index.ejs
├── orderDetails.json
├── index.js
├── .env
├── package.json
└── README.md

markdown
Copy code

## Contributing

Contributions are welcome! Please open an issue or submit a pull request with your changes.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Acknowledgements

- [Node.js](https://nodejs.org/)
- [Express](https://expressjs.com/)
- [Socket.io](https://socket.io/)
- [EJS](https://ejs.co/)
- [Square API](https://developer.squareup.com/)

Instructions:
Clone the Repository:

bash
Copy code
git clone https://github.com/your-username/real-time-order-management-system.git
Navigate to the Project Directory:

bash
Copy code
cd real-time-order-management-system
Install Dependencies:

bash
Copy code
npm install
Create an .env File: Add your Square API key to a new .env file in the root directory.

Run the Server:

bash
Copy code
npm start
This setup will help you maintain a clean and well-documented repository for your real-time order management system.
