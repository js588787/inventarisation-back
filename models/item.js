const { Sequelize } = require("sequelize");

module.exports = (sequelize) => {
  const Item = sequelize.define("Item", {
    id: {
        primaryKey: true,
        type: Sequelize.INTEGER,
        autoIncrement: true,
        unique: true,
        allowNull: false, 
    },
    type: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    title: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    model:{
        type: Sequelize.STRING,
        allowNull: false,
    },
    serialNumber: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    invNumber: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    status: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    description: {
      type: Sequelize.STRING,
    },
    user: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    roomNumber: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    qrCode: {
      type: Sequelize.STRING,
      allowNull: false,
    }
  },
  {
    timestamps: false,
  });
  return Item;
};