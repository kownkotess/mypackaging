# MyPackaging Shop System

A comprehensive React-based inventory and sales management system for MyPackaging store.

## Features

### 🏪 Core Business Operations
- **Product Management**: Add, edit, delete products with stock tracking
- **Sales Management**: Point-of-sale system with receipt generation
- **Purchase Management**: Purchase order tracking and inventory updates
- **Credit Management (Hutang)**: Track customer credit sales and payments
- **Stock Monitoring**: Real-time stock alerts and inventory tracking

### 📊 Analytics & Reporting
- **Analytics Dashboard**: Sales trends, profit analysis, and business insights
- **Business Reports**: Comprehensive sales, purchase, and credit reports
- **Real-time KPIs**: Today's sales, stock alerts, outstanding credit tracking

### 🔐 Security & Access Control
- **Role-Based Access Control**: Admin, Manager, and Staff permission levels
- **Secure Authentication**: Firebase Authentication with custom user roles
- **Audit Trail**: Comprehensive logging of all business operations
- **Data Security**: Admin-only sensitive operations with password verification

### ⚙️ System Management
- **Settings Panel**: System configuration and user management
- **Audit Log Management**: 6-month retention policy with secure cleanup
- **Email Integration**: Automated notifications and receipt delivery
- **Responsive Design**: Works on desktop, tablet, and mobile devices

## Technology Stack

- **Frontend**: React 18.2.0
- **Backend**: Firebase Firestore
- **Authentication**: Firebase Auth
- **Styling**: CSS3 with responsive design
- **State Management**: React Context API
- **Real-time Updates**: Firestore listeners

## User Roles

### Admin (admin@mypackaging.com)
- Full system access
- User management
- System settings
- Audit log management
- All CRUD operations

### Manager (khairul@, yeen@, shazila@, masliza@mypackaging.com)
- Sales and purchase management
- Product management
- Credit management
- Analytics and reports
- No system administration

### Staff (cashier@mypackaging.com)
- Sales creation only
- Basic product viewing
- Limited dashboard access
- Cannot change passwords

## Getting Started

### Prerequisites
- Node.js 14.0 or higher
- Firebase project with Firestore enabled

### Installation

1. Clone the repository
```bash
git clone [repository-url]
cd mypackaging
```

2. Install dependencies
```bash
npm install
```

3. Configure Firebase
- Add your Firebase configuration to `src/firebase.js`
- Update Firestore rules from `firestore.rules`

4. Start the development server
```bash
npm start
```

5. Build for production
```bash
npm run build
```

## Security Features

- **Password Verification**: Critical operations require admin password confirmation
- **Audit Logging**: All actions are logged with user tracking and timestamps
- **Role Verification**: Server-side role checking in Firestore rules
- **Data Retention**: Automatic 6-month audit log cleanup
- **Secure Deletion**: Admin-only delete operations with confirmation

## Business Operations Tracked

- Product creation, updates, and deletion
- Sales transactions and modifications
- Purchase orders and inventory updates
- Credit sales and payment tracking
- Stock adjustments and alerts
- User actions and system changes

## Support

For support or questions about the MyPackaging Shop System, contact the system administrator.

---

**MyPackaging Shop System** - Comprehensive business management for modern retail operations.