import { Model, DataTypes } from 'sequelize'
import { sequelize } from '../util/db'

export class Storage extends Model {
    declare locationId: number
    declare amount: number
}

Storage.init({
    locationId: {
        type: DataTypes.INTEGER,
        primaryKey: true,

    },
    palletTypeId: {
        type: DataTypes.INTEGER,
        primaryKey: true,

    },
    amount: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
}, {
    sequelize,
    modelName: 'storage',
    timestamps: false,
})




