import { model, Schema, Types } from 'mongoose';

const conversationSchema = new Schema(
  {
    roomId: {
      type: String,
      unique: true,
      require: true,
    },
    members: {
      type: [Types.ObjectId, Types.ObjectId],
      require: true,
      ref: 'User',
    },
  },
  {
    strict: true,
    timestamps: true,
  },
);

const Conversation = model('Conversation', conversationSchema);

export default Conversation;
