import mongoose, { Schema, Document } from 'mongoose';

export interface IRestaurant extends Document {
  name: string;
  ownerEmail: string;
  createdAt: Date;
}

const RestaurantSchema: Schema = new Schema({
  name: { type: String, required: true },
  ownerEmail: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model<IRestaurant>('Restaurant', RestaurantSchema);