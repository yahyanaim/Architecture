// plug in rabbit/kafka/sqs here later
export class EventBus {
  publish(eventName: string, payload: any) {
    console.log(`[EventBus] Publishing ${eventName}:`, payload);
  }
}
