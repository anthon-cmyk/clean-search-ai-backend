import { Controller, Post, Body } from '@nestjs/common';
import { AiService } from './openai.service';

@Controller('ai')
export class AiController {
  constructor(private ai: AiService) {}

  @Post('chat')
  async chat(@Body() body: { prompt: string }) {
    const result = await this.ai.ask(body.prompt);
    return result.choices[0].message;
  }
}
