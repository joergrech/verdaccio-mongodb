import { getWeekNumber } from '../src/mongoConnector.js';

describe('mongoConnector', () => {
  // jest.setTimeout(10000); // required for bcrypt.compareSync - which is intentionally slow!

  beforeEach(() => {
    jest.resetModules();
  });

  describe('getWeekNumber()', () => {
    test('get correct week number', done => {
      // NOTE: month is 0 based
      expect( getWeekNumber(new Date(2022,  0,  1)) ).toBe(52);
      expect( getWeekNumber(new Date(2022,  0,  5)) ).toBe(1);
      expect( getWeekNumber(new Date(2022,  5,  5)) ).toBe(22);
      expect( getWeekNumber(new Date(2022, 11, 31)) ).toBe(52);
      expect( getWeekNumber(new Date(2014, 11, 30)) ).toBe(1);
      expect( getWeekNumber(new Date(2012,  0,  1)) ).toBe(52);
      done();
    });

  });
});
