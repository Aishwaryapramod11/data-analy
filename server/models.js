import { Sequelize, DataTypes } from 'sequelize';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Sequelize with SQLite database file
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, 'database.sqlite'),
  logging: false, // Set to console.log to debug SQL queries
});

// User model for dashboard access
const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true,
    },
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
}, {
  timestamps: true,
});

// PageEvent model to log page views and interactions
const PageEvent = sequelize.define('PageEvent', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  pageUrl: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  referrer: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: 'Direct',
  },
  device: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: 'Desktop',
  },
  browser: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: 'Unknown',
  },
  os: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: 'Unknown',
  },
  country: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: 'Unknown',
  },
  duration: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0, // Duration in seconds
  },
  sessionId: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: true, // Optional field linking page view to a registered user
  },
  timestamp: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  timestamps: true,
  indexes: [
    {
      fields: ['timestamp'],
    },
    {
      fields: ['sessionId'],
    },
  ],
});

export { sequelize, User, PageEvent };
