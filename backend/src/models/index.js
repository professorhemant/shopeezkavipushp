const sequelize = require('../config/database');

// Import all models
const User = require('./User');
const Role = require('./Role');
const Permission = require('./Permission');
const Firm = require('./Firm');
const Category = require('./Category');
const Brand = require('./Brand');
const Unit = require('./Unit');
const Product = require('./Product');
const ProductVariant = require('./ProductVariant');
const InventoryBatch = require('./InventoryBatch');
const Customer = require('./Customer');
const Supplier = require('./Supplier');
const Sale = require('./Sale');
const SaleItem = require('./SaleItem');
const Purchase = require('./Purchase');
const PurchaseItem = require('./PurchaseItem');
const Payment = require('./Payment');
const Expense = require('./Expense');
const ExpenseCategory = require('./ExpenseCategory');
const FixedAsset = require('./FixedAsset');
const Appointment = require('./Appointment');
const WhatsAppCampaign = require('./WhatsAppCampaign');
const WhatsappMessage  = require('./WhatsappMessage');
const EWayBill = require('./EWayBill');
const EInvoice = require('./EInvoice');
const StockAlert = require('./StockAlert');
const Settings = require('./Settings');

// ─── Associations ────────────────────────────────────────────────
// User <-> Role
User.belongsToMany(Role, { through: 'user_roles', foreignKey: 'user_id', as: 'roleData' });
Role.belongsToMany(User, { through: 'user_roles', foreignKey: 'role_id', as: 'users' });

// Role <-> Permission
Role.belongsToMany(Permission, { through: 'role_permissions', foreignKey: 'role_id' });
Permission.belongsToMany(Role, { through: 'role_permissions', foreignKey: 'permission_id' });

// Firm
User.belongsTo(Firm, { foreignKey: 'firm_id', as: 'firm' });
Firm.hasMany(User, { foreignKey: 'firm_id', as: 'members' });

// Category hierarchy
Category.hasMany(Category, { as: 'children', foreignKey: 'parent_id' });
Category.belongsTo(Category, { as: 'parent', foreignKey: 'parent_id' });

// Product associations
Product.belongsTo(Category, { foreignKey: 'category_id', as: 'Category' });
Category.hasMany(Product, { foreignKey: 'category_id' });
Product.belongsTo(Brand, { foreignKey: 'brand_id', as: 'Brand' });
Brand.hasMany(Product, { foreignKey: 'brand_id' });
Product.belongsTo(Unit, { foreignKey: 'unit_id', as: 'Unit' });
Unit.hasMany(Product, { foreignKey: 'unit_id' });
Product.hasMany(ProductVariant, { foreignKey: 'product_id', as: 'variants' });
ProductVariant.belongsTo(Product, { foreignKey: 'product_id' });
Product.hasMany(InventoryBatch, { foreignKey: 'product_id', as: 'batches' });
InventoryBatch.belongsTo(Product, { foreignKey: 'product_id', as: 'Product' });

// Sale associations
Sale.belongsTo(Customer, { foreignKey: 'customer_id', as: 'customer' });
Customer.hasMany(Sale, { foreignKey: 'customer_id' });
Sale.belongsTo(Firm, { foreignKey: 'firm_id', as: 'firm' });
Sale.hasMany(SaleItem, { foreignKey: 'sale_id', as: 'items' });
SaleItem.belongsTo(Sale, { foreignKey: 'sale_id', as: 'Sale' });
SaleItem.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });
Sale.hasMany(Payment, { foreignKey: 'sale_id', as: 'payments' });
Sale.hasOne(EInvoice, { foreignKey: 'sale_id' });
Sale.hasOne(EWayBill, { foreignKey: 'sale_id' });
Sale.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

// Purchase associations
Purchase.belongsTo(Supplier, { foreignKey: 'supplier_id', as: 'Supplier' });
Supplier.hasMany(Purchase, { foreignKey: 'supplier_id' });
Purchase.hasMany(PurchaseItem, { foreignKey: 'purchase_id', as: 'items' });
PurchaseItem.belongsTo(Purchase, { foreignKey: 'purchase_id', as: 'Purchase' });
PurchaseItem.belongsTo(Product, { foreignKey: 'product_id' });

// Expense
Expense.belongsTo(ExpenseCategory, { foreignKey: 'category_id' });
ExpenseCategory.hasMany(Expense, { foreignKey: 'category_id' });

// Appointment
Appointment.belongsTo(Customer, { foreignKey: 'customer_id', as: 'customer' });
Appointment.belongsTo(User, { foreignKey: 'staff_id', as: 'staff' });

// WhatsApp Campaign
WhatsAppCampaign.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

module.exports = {
  sequelize,
  User,
  Role,
  Permission,
  Firm,
  Category,
  Brand,
  Unit,
  Product,
  ProductVariant,
  InventoryBatch,
  Customer,
  Supplier,
  Sale,
  SaleItem,
  Purchase,
  PurchaseItem,
  Payment,
  Expense,
  ExpenseCategory,
  FixedAsset,
  Appointment,
  WhatsAppCampaign,
  WhatsappMessage,
  EWayBill,
  EInvoice,
  StockAlert,
  Settings,
};
