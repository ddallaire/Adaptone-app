import { expect } from 'chai';
import { describe, it, beforeEach } from 'mocha';
import { setupComponentTest } from 'ember-mocha';
import Service from '@ember/service';

const retrieveGestures = () => {
  return null;
}

const gesturesServiceStub = Service.extend({
  retrieve: retrieveGestures
});

describe('Unit | Component | aa-knob', function() {
  setupComponentTest('aa-knob', {
    unit: true
  });

  let component;

  describe('with min, mid and max', () => {
    beforeEach(function() {
      this.register('service:-gestures', gesturesServiceStub);
      component = this.subject();
      component.setProperties({
        min: 16,
        mid: 600,
        max: 12000,
        onValueChange: function() {
          return 0;
        }
      });
    });

    describe('computed', () => {
      describe('degreesValue', () => {
        it('should return the normalized degree value from the value', () => {
          component.set('value', 16);
          expect(Math.round(component.get('degreesValue'))).to.equal(0);
          component.set('value', 600);
          expect(Math.round(component.get('degreesValue'))).to.equal(135);
          component.set('value', 1200);
          expect(Math.round(component.get('degreesValue'))).to.equal(142);
        });

        it('should return the normalized degree value from the value on small ranges', () => {
          component.setProperties({
            min: 1,
            mid: 2,
            max: 4,
            onValueChange: function() {
              return 0;
            }
          });

          component.set('value', 1);
          expect(Math.round(component.get('degreesValue'))).to.equal(0);
          component.set('value', 2);
          expect(Math.round(component.get('degreesValue'))).to.equal(135);
          component.set('value', 3);
          expect(Math.round(component.get('degreesValue'))).to.equal(203);
        });
      });
    });

    describe('private functions', () => {
      describe('alignTop', () => {
        it('should remove 45 from the angle value', () => {
          const result = component._alignTop(90);

          expect(result).to.equal(45);
        });
      });
    });
  });
});
