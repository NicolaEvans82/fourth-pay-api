import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  Optional,
  Param,
} from '@nestjs/common';
import { Iq360Service } from '../../common/instrumentation/iq360.service';
import {
  type Article,
  LearningService,
  type LearningResponse,
} from './learning.service';

const HEADER_FOURTH_EMPLOYEE_ID = 'x-fourth-employee-id';
const HEADER_FOURTH_EMPLOYER_ID = 'x-fourth-employer-id';

@Controller('api/v1/learning')
export class LearningController {
  constructor(
    private readonly service: LearningService,
    @Optional() private readonly iq360?: Iq360Service,
  ) {}

  @Get()
  list(@Headers() headers: Record<string, string>): LearningResponse {
    const { fourthEmployeeId, fourthEmployerId } = extractIds(headers);
    const result = this.service.list();
    this.iq360?.emit('learning.list.viewed', {
      employee_id: fourthEmployeeId,
      employer_id: fourthEmployerId,
      properties: {
        category_count: result.categories.length,
        article_count: result.categories.reduce(
          (sum, c) => sum + c.articles.length,
          0,
        ),
      },
    });
    return result;
  }

  @Get(':id')
  get(
    @Headers() headers: Record<string, string>,
    @Param('id') id: string,
  ): Article {
    const { fourthEmployeeId, fourthEmployerId } = extractIds(headers);
    const article = this.service.get(id);
    this.iq360?.emit('learning.article.viewed', {
      employee_id: fourthEmployeeId,
      employer_id: fourthEmployerId,
      properties: {
        article_id: article.id,
        category: article.category,
      },
    });
    return article;
  }
}

function extractIds(headers: Record<string, string>): {
  fourthEmployeeId: string;
  fourthEmployerId: string;
} {
  const fourthEmployeeId = headers[HEADER_FOURTH_EMPLOYEE_ID];
  const fourthEmployerId = headers[HEADER_FOURTH_EMPLOYER_ID];
  if (!fourthEmployeeId || !fourthEmployerId) {
    throw new BadRequestException(
      `Missing required headers: ${HEADER_FOURTH_EMPLOYEE_ID}, ${HEADER_FOURTH_EMPLOYER_ID}`,
    );
  }
  return { fourthEmployeeId, fourthEmployerId };
}
