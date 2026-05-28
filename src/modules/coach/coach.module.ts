import { Module } from '@nestjs/common';
import { EwaModule } from '../ewa/ewa.module';
import { SelfControlsModule } from '../self-controls/self-controls.module';
import { CoachController } from './coach.controller';
import { CoachService } from './coach.service';

@Module({
  imports: [EwaModule, SelfControlsModule],
  controllers: [CoachController],
  providers: [CoachService],
})
export class CoachModule {}
