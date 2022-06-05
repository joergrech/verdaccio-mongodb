
import {intersect} from '../src/helpers';

describe('helpers', () => {

  beforeEach(() => {
    jest.resetModules();
  });

  const arrayABC = ['A','B','C']
  const arrayXYZ = ['X','Y','Z']
  const arrayAXYZ = ['A','X','Y','Z']
  const arrayABYZ = ['A','B','Y','Z']
  const arrayBAYZ = ['B','A','Y','Z']
  
  describe('intersect()', () => {
    test('extract the correct intersections', (done) => {
      expect(intersect(arrayABC,arrayAXYZ)).toEqual(['A']);
      expect(intersect(arrayABC,arrayAXYZ)).toContain('A');
      expect(intersect(arrayABC,arrayABYZ)).toContain('B');
      expect(intersect(arrayABC,arrayABYZ)).toEqual(['A','B']);
      expect(intersect(arrayABC,arrayBAYZ)).toEqual(['A','B']);
      expect(intersect(arrayABC,arrayXYZ)).toEqual([]);
      done();
    });
  });

});
