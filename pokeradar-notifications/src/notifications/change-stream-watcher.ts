/**
 * MongoDB change stream watcher for the notifications collection.
 * Listens for new notification documents and forwards them for processing.
 * Requires a MongoDB replica set.
 */

import mongoose from 'mongoose';
import { NotificationModel, INotificationDoc } from '@pokeradar/shared';
import { ILogger } from '../shared/logger';

export type NotificationHandler = (doc: INotificationDoc) => void;

export class ChangeStreamWatcher {
  private changeStream: mongoose.mongo.ChangeStream | null = null;
  private running = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private logger: ILogger) {}

  /**
   * Starts watching for new notification inserts.
   * Automatically reconnects on stream errors.
   */
  start(onNotification: NotificationHandler): void {
    this.running = true;
    this.watch(onNotification);
  }

  /**
   * Stops watching and closes the change stream.
   */
  async stop(): Promise<void> {
    this.running = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    await this.closeStream();
    this.logger.info('Change stream watcher stopped');
  }

  private watch(onNotification: NotificationHandler): void {
    if (!this.running) return;

    const pipeline = [{ $match: { operationType: 'insert' } }];

    this.changeStream = NotificationModel.watch(pipeline, { fullDocument: 'updateLookup' });

    this.changeStream.on('change', (change: any) => {
      if (change.fullDocument) {
        this.logger.debug('Change stream received notification', {
          id: change.fullDocument._id?.toString(),
        });
        onNotification(change.fullDocument as INotificationDoc);
      }
    });

    this.changeStream.on('error', (error) => {
      this.logger.error('Change stream error', error);
      this.reconnect(onNotification);
    });

    this.changeStream.on('close', () => {
      if (this.running) {
        this.logger.warn('Change stream closed unexpectedly');
        this.reconnect(onNotification);
      }
    });

    this.logger.info('Change stream watcher started');
  }

  private reconnect(onNotification: NotificationHandler): void {
    if (!this.running || this.reconnectTimer) return;

    this.closeStream();
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.watch(onNotification);
    }, 1000);
  }

  private closeStream(): void {
    if (this.changeStream) {
      this.changeStream.removeAllListeners();
      this.changeStream.close().catch(() => {});
      this.changeStream = null;
    }
  }
}
