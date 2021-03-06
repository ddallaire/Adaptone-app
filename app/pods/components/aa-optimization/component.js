import Component from '@ember/component';
import {inject as service} from '@ember/service';
import steps from 'adaptone-front/models/steps';
import SequenceIds from 'adaptone-front/constants/sequence-ids';

export default Component.extend({
  fileSystem: service('file-system'),
  router: service('router'),
  session: service('session'),
  connection: service('connection'),
  packetDispatcher: service('packet-dispatcher'),

  positions: null,
  isOptimizing: false,

  actions: {
    startOptimization() {
      this.set('isOptimizing', true);

      this.get('connection').sendMessage({
        seqId: SequenceIds.OPTIMIZE_POS
      });

      this.get('packetDispatcher').one('optimized-positions', (data) => {
        this.set('positions', data.positions);
        this.get('router').transitionTo('optimal-positions', {queryParams: {positions: JSON.stringify(data.positions)}});
      });
    },

    loadConsole() {
      const configuration = this.get('session').get('configuration');
      configuration.step = steps['console-loading:'];
      configuration.positions = this.get('positions');

      this.get('connection').sendMessage({
        seqId: SequenceIds.CONFIG_CHOICE,
        data: configuration
      });

      this.get('fileSystem').editConfiguration(configuration);
      this.get('session').set('configuration', configuration);
      this.router.transitionTo('console');
    }
  }
});
