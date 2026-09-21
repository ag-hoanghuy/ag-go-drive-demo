import {
  BadRequestException,
  createParamDecorator,
  type ExecutionContext,
} from '@nestjs/common';

interface DemoSessionRequest {
  headers: {
    'x-demo-session-id'?: string | string[];
  };
}

const DEMO_SESSION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const DemoSessionId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const request = context.switchToHttp().getRequest<DemoSessionRequest>();
    const sessionId = request.headers['x-demo-session-id'];

    if (
      typeof sessionId !== 'string' ||
      !DEMO_SESSION_ID_PATTERN.test(sessionId)
    ) {
      throw new BadRequestException('Demo session không hợp lệ');
    }

    return sessionId;
  },
);

