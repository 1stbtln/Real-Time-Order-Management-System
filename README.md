# Order Management System

This repository contains a Node.js application that manages orders and integrates with Square and Twilio for handling payments and notifications. The system includes real-time updates, order processing, and an admin interface.

## Features

- **Real-time Order Updates**: Uses Socket.IO for real-time updates on order statuses.
- **Webhook Handling**: Handles webhooks from Square and Fresh KDS for order updates and notifications.
- **Order Storage**: Stores order details in JSON files and handles CRUD operations.
- **SMS Notifications**: Sends SMS notifications to customers using Twilio when the order status changes.
- **Admin Interface**: Provides an admin interface for viewing and managing orders.

## Technologies Used

- Node.js
- Express
- Socket.IO
- Axios
- Twilio
- EJS (Embedded JavaScript Templates)
- Moment.js
- Bootstrap
- HTML/CSS

## Installation

1. **Clone the repository**:
    ```bash
    git clone https://github.com/yourusername/order-management-system.git
    cd order-management-system
    ```

2. **Install dependencies**:
    ```bash
    npm install
    ```

3. **Set up environment variables**:
    Create a `.env` file in the root directory and add your environment variables:
    ```env
    API_KEY=your_square_api_key
    TWILIO_PHONE_NUMBER=your_twilio_phone_number
    ACCOUNT_SID=your_twilio_account_sid
    AUTH_TOKEN=your_twilio_auth_token
    ```

4. **Start the server**:
    ```bash
    npm start
    ```

    The server will start on `http://localhost:3000`.

## Usage

### Main Page

- Access the main page at `http://localhost:3000` to view the current orders and their statuses.
- Orders are displayed in three categories: Pending, In the Oven, and Ready for Pickup.

### Admin Interface

- Access the admin login page at `http://localhost:3000/adminLogin`.
- After logging in, view and manage orders at `http://localhost:3000/admin`.

### Webhooks

- **Square Webhook**: Handles payment creation events from Square. Updates order details and notifies customers.
- **Fresh KDS Webhook**: Handles KDS events to update order statuses and notify customers.

### SMS Notifications

- Sends SMS notifications to customers when their order status changes (e.g., "in the oven" or "ready for pickup").

## File Structure

- `server.js`: Main server file handling routes, webhooks, and order processing.
- `views/`: Contains EJS templates for rendering HTML pages.
- `public/`: Contains static files such as CSS and client-side JavaScript.
- `orderDetails.json`: Stores order details.
- `processedEvents.json`: Stores IDs of processed events to prevent duplicate processing.

## API Endpoints

- `GET /`: Main page displaying current orders.
- `GET /adminLogin`: Admin login page.
- `GET /admin`: Admin interface for managing orders.
- `POST /webhooks/square`: Webhook endpoint for handling Square payment events.
- `POST /webhooks/fresh-kds`: Webhook endpoint for handling Fresh KDS events.
- `POST /delete-json`: Clears all orders.
- `DELETE /delete-order/:id`: Deletes a specific order by ID.
- `POST /update-order-status`: Updates the status of a specific order.

## Scripts

- **Start Server**: `npm start` - Starts the server on port 3000.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Square API](https://developer.squareup.com/reference/square)
- [Twilio API](https://www.twilio.com/docs/usage/api)
- [Bootstrap](https://getbootstrap.com)
- [Socket.IO](https://socket.io)
- [Moment.js](https://momentjs.com)

Feel free to fork this repository and contribute! If you encounter any issues or have suggestions, please open an issue or submit a pull request.

---

This README provides an overview of the Order Management System, including features, installation steps, usage instructions, and the file structure. The system integrates with Square for handling payments and Twilio for sending SMS notifications, and it uses Socket.IO for real-time updates.
