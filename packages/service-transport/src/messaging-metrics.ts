export enum MessagingMetric {OUTBOX_BACKLOG = 'outbox_backlog', PUBLISHES = 'publishes_total', PUBLISH_FAILURES = 'publish_failures_total', CONSUMER_LAG = 'consumer_lag', DELIVERIES = 'deliveries_total', REDELIVERIES = 'redeliveries_total', ACKNOWLEDGED = 'acknowledged_total', RETRIES = 'retries_total', POISON = 'poison_total', ADVISORIES = 'advisories_total', ACK_FAILURES = 'ack_failures_total'}

export class MessagingMetrics {
  private static readonly instances = new Map<string, MessagingMetrics>();

  static forService(service:string):MessagingMetrics {let metrics = this.instances.get(service);

if (!metrics) {metrics = new MessagingMetrics(service);this.instances.set(service, metrics);}

 return metrics;}

  private readonly values = new Map<MessagingMetric, number>();

  constructor(readonly service:string) {if (!/^[a-z][a-z0-9-]{0,63}$/.test(service)) throw new Error('Invalid messaging metric service');

for (const name of Object.values(MessagingMetric)) this.values.set(name, 0);}

  set(name:MessagingMetric, value:number):void {if (!Number.isFinite(value) || value < 0) throw new Error('Invalid messaging metric');this.values.set(name, value);}

  increment(name:MessagingMetric):void {this.set(name, (this.values.get(name) ?? 0) + 1);}

  render():string {return [...this.values].map(([name, value])=>'sportsbook_messaging_' + name + '{service="' + this.service + '"} ' + value).join('\n') + '\n';}
}
