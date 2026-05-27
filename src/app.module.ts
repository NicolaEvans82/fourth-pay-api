import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EwaModule } from './modules/ewa/ewa.module';

@Module({
  imports: [EwaModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
