import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EwaModule } from './modules/ewa/ewa.module';
import { SelfControlsModule } from './modules/self-controls/self-controls.module';

@Module({
  imports: [EwaModule, SelfControlsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
