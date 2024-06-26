import { Model, DataTypes } from 'sequelize'
import { sequelize } from '../util/db'
import { formatDateTime } from '../util/datetimeUtils'

export class LocationPrice extends Model {
    declare locationPriceId: number
    declare locationId: number
    declare price: number
    declare validFrom: string
}

LocationPrice.init({
    locationPriceId: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    locationId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    price: {
        type: DataTypes.FLOAT,
        allowNull: false
    },
    validFrom: {
        type: DataTypes.DATE,
        allowNull: false,
    },
}, {
    sequelize,
    modelName: 'locationPrice',
    timestamps: false,
})