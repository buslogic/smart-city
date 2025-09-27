import { SetMetadata } from '@nestjs/common';

export const SKIP_GLOBAL_VALIDATION = 'skipGlobalValidation';
export const SkipGlobalValidation = () => SetMetadata(SKIP_GLOBAL_VALIDATION, true);