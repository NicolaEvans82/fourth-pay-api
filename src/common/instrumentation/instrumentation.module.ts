import { Global, Module } from '@nestjs/common';
import { Iq360Service } from './iq360.service';

// Global so every feature module can @Inject(Iq360Service) without
// having to re-import the module. The service is stateless — a single
// instance per process is correct.
@Global()
@Module({
  providers: [Iq360Service],
  exports: [Iq360Service],
})
export class InstrumentationModule {}
