import { Model, DataTypes, BelongsToGetAssociationMixin } from 'sequelize'
import { sequelize } from '../util/db'
import { Order } from './Order'

export class OrderRow extends Model {
    declare orderId: number
    declare productId: number
    declare palletAmount: number
    declare getOrder: BelongsToGetAssociationMixin<Order>
}

OrderRow.init({
    orderId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
    },
    productId: {
        type: DataTypes.INTEGER,
        primaryKey: true,

    },
    palletAmount: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
}, {
    sequelize,
    modelName: 'orderRow',
    timestamps: false,
})




