import { Controller, HttpCode, HttpStatus, Logger, Post } from '@nestjs/common';
import { InMemoryEwaTransferStore } from '../../database/ewa-transfer.store';
import { InMemoryNotificationsStore } from '../../database/notifications.store';
import { InMemorySavingsPotStore } from '../../database/savings-pot.store';
import { InMemorySelfControlsStore } from '../../database/self-controls.store';

// Demo-only endpoint. Wipes the three in-memory stores and re-runs
// their seeders so a live demo can be repeated without restarting
// Railway. Production should never expose this — when DatabaseModule
// lands, drop the entire DemoModule registration from AppModule.
@Controller('api/v1/demo')
export class DemoController {
  private readonly logger = new Logger(DemoController.name);

  constructor(
    private readonly transfers: InMemoryEwaTransferStore,
    private readonly selfControls: InMemorySelfControlsStore,
    private readonly notifications: InMemoryNotificationsStore,
    private readonly pots: InMemorySavingsPotStore,
  ) {}

  @Post('reset')
  @HttpCode(HttpStatus.OK)
  reset(): { reset: true } {
    this.transfers.resetToSeed();
    this.selfControls.resetToSeed();
    this.notifications.resetToSeed();
    this.pots.resetToSeed();
    this.logger.log('Demo data reset to original seed state');
    return { reset: true };
  }
}
