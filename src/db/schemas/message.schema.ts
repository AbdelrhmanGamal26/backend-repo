import { model, Schema, Types } from 'mongoose';

const messageSchema = new Schema(
  {
    conversationId: {
      type: Types.ObjectId,
      ref: 'Conversation',
      require: true,
    },
    senderId: {
      type: Types.ObjectId,
      require: true,
    },
    content: {
      type: String,
      require: true,
    },
  },
  {
    strict: true,
    timestamps: true,
  },
);

const Message = model('Message', messageSchema);

export default Message;
