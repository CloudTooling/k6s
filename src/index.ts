import { getBearerTokenWithClientAssertion } from './jwt';
import { jUnit } from 'k6-junit';

export default {
  getBearerTokenWithClientAssertion,
  generateJunitReport: jUnit,
};
