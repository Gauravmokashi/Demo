import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

const KNOWN_ERRORS: Record<string, { status: HttpStatus; message: string }> = {
  P2000: { status: HttpStatus.BAD_REQUEST, message: 'A value is too long or out of range.' },
  P2002: { status: HttpStatus.CONFLICT, message: 'A record with these values already exists.' },
  P2003: { status: HttpStatus.CONFLICT, message: 'The change conflicts with a related record.' },
  P2020: { status: HttpStatus.BAD_REQUEST, message: 'A value is out of range.' },
  P2025: { status: HttpStatus.NOT_FOUND, message: 'Record not found.' },
};

/** Turns database errors caused by bad input into 4xx responses instead of opaque 500s. */
@Catch(Prisma.PrismaClientKnownRequestError, Prisma.PrismaClientValidationError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(
    exception: Prisma.PrismaClientKnownRequestError | Prisma.PrismaClientValidationError,
    host: ArgumentsHost,
  ) {
    const response = host.switchToHttp().getResponse<Response>();
    const code = exception instanceof Prisma.PrismaClientKnownRequestError ? exception.code : 'VALIDATION';
    const mapped =
      code === 'VALIDATION'
        ? { status: HttpStatus.BAD_REQUEST, message: 'Invalid request data.' }
        : (KNOWN_ERRORS[code] ?? {
            status: HttpStatus.INTERNAL_SERVER_ERROR,
            message: 'Internal server error.',
          });

    if (mapped.status >= 500) {
      this.logger.error(`Unhandled database error ${code}`, exception.stack);
    } else {
      this.logger.warn(`Database error ${code} returned as ${mapped.status}`);
    }
    response.status(mapped.status).json({ statusCode: mapped.status, message: mapped.message });
  }
}
