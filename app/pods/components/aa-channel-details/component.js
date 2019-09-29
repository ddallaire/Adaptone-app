import Component from '@ember/component';
import {computed} from '@ember/object';
import {inject as service} from '@ember/service';
import {debounce} from '@ember/runloop';
import {set} from '@ember/object';

import SequenceIds from 'adaptone-front/constants/sequence-ids';

const DEBOUNCE_TIME = 20;
const MAX_GAIN_VALUE = 12;
const DECIBEL_CONVERT = 10;
const DECIBEL_FACTOR = 20;

export default Component.extend({
  connection: service('connection'),
  packetDispatcher: service('packet-dispatcher'),
  session: service('session'),

  isParametric: true,

  parametricEqGraphValues: null,
  graphicEqGraphValues: null,

  peakMeterValue: null,

  userChannelVolume: 0,
  userChannelGain: 0,

  hasNewChanges: false,

  isEqVisible: true,
  isInputVolumeVisible: false,

  isAuxiliaryInput: computed('channel.data.isAuxiliaryInput', function() {
    return this.get('channel').data.isAuxiliaryInput === true;
  }),

  isMasterInput: computed('channel.data.isMasterInput', function() {
    return this.get('channel').data.isMasterInput === true;
  }),

  isAuxiliaryOutput: computed('channel.data.isAuxiliaryOutput', function() {
    return this.get('channel').data.isAuxiliaryOutput === true;
  }),

  isMasterOutput: computed('channel.data.isMasterOutput', function() {
    return this.get('channel').data.isMasterOutput === true;
  }),

  isOutput: computed('channel.data.{isMasterOutput,isAuxiliaryOutput}', function() {
    return this.get('channel').data.isMasterOutput === true || this.get('channel').data.isAuxiliaryOutput === true;
  }),

  didInsertElement() {
    const currentChannelId = this.get('channel').data.channelId;

    // Since we only have peak meters for the inputs in channel details,
    // we only set the inputAfterEq for those
    if (!this.get('isOutput')) {
      this.get('packetDispatcher').on('peakmeter-levels', (data) => {
        if (!data) return;

        this.set('peakMeterValue', data.inputAfterGain.find(input => input.channelId === currentChannelId).level);
      });

      // TODO : Remove this test data later
      const peakMeterTestValues = {
        data: {
          inputAfterGain: [
            {
              channelId: 1,
              level: 0.1
            },
            {
              channelId: 2,
              level: 0.3
            },
            {
              channelId: 3,
              level: 0.2
            },
            {
              channelId: 4,
              level: 0.8
            }
          ]
        }
      };

      this.set('peakMeterValue', peakMeterTestValues.data.inputAfterGain.find(input => input.channelId === currentChannelId).level);
    }

    this._super(...arguments);
    this.set('hasNewChanges', false);
  },

  willDestroyElement() {
    this.get('packetDispatcher').off('peakmeter-levels');
  },

  _updateSessionConfiguration() {
    const configuration = this.get('session').get('configuration');
    const {channel, isAuxiliaryInput, isMasterInput, isAuxiliaryOutput, isMasterOutput}
      = this.getProperties('channel', 'isAuxiliaryInput', 'isMasterInput', 'isAuxiliaryOutput', 'isMasterOutput');

    if (isAuxiliaryOutput) {
      const auxIndex = configuration.channels.auxiliaries.findIndex(aux => aux.data.auxiliaryChannelId === channel.data.auxiliaryChannelId);
      configuration.channels.auxiliaries[auxIndex] = channel;
    } else if (isMasterOutput) {
      set(configuration.channels, 'master', channel);
    } else if (isAuxiliaryInput) {
      const auxIndex = configuration.channels.auxiliaries.findIndex(aux => aux.data.auxiliaryChannelId === channel.data.auxiliaryChannelId);
      const inputIndex = configuration.channels.auxiliaries[auxIndex].data.inputs.findIndex(input => input.data.channelId === channel.data.channelId);
      configuration.channels.auxiliaries[auxIndex].data.inputs[inputIndex] = channel;
    } else if (isMasterInput) {
      const inputIndex = configuration.channels.master.data.inputs.findIndex(input => input.data.channelId === channel.data.channelId);
      configuration.channels.master.data.inputs[inputIndex] = channel;
    } else {
      const inputIndex = configuration.channels.inputs.findIndex(input => input.data.channelId === channel.data.channelId);
      configuration.channels.inputs[inputIndex] = channel;
    }

    this.get('session').set('configuration', configuration);
    this.set('hasNewChanges', true);
  },

  actions: {
    onEqChange() {
      this._updateSessionConfiguration();
    },

    onGainChange(value) {
      this._updateSessionConfiguration();

      const ratioGain = Math.pow(DECIBEL_CONVERT, value / DECIBEL_FACTOR);

      const message = {
        seqId: SequenceIds.CHANGE_INPUT_GAIN,
        data: {
          channelId: this.get('channel').data.channelId,
          gain: ratioGain
        }
      };

      debounce(this.get('connection'), this.get('connection').sendMessage, message, DEBOUNCE_TIME);

      return value;
    },

    onIsMutedChange(value) {
      this._updateSessionConfiguration();
      return value;
    },

    onIsSoloChange(value) {
      this._updateSessionConfiguration();
      return value;
    },

    saveConfiguration() {
      this.get('session').dumpSessionInFile();
      this.set('hasNewChanges', false);
    },

    onEqTabClick() {
      this.set('isInputVolumeVisible', false);
      this.set('isEqVisible', true);
    },

    onInputVolumeTabClick() {
      this.set('isEqVisible', false);
      this.set('isInputVolumeVisible', true);
    },

    onInputChannelMuteChange(channel) {
      this._updateSessionConfiguration();

      let gain = channel.gain;

      if (channel.isMuted) gain = 0;
      if (this.get('channel').data.inputs.some(c => c.data.isSolo && c.data.channelId !== channel.channelId)) gain = 0;

      const message = {
        seqId: SequenceIds.CHANGE_AUX_VOLUME_INPUT,
        data: {
          channelId: this.get('channel').data.channelId,
          gain: gain / MAX_GAIN_VALUE
        }
      };

      debounce(this.get('connection'), this.get('connection').sendMessage, message, DEBOUNCE_TIME);
    },

    onInputChannelSoloChange() {
      this._updateSessionConfiguration();

      const channelInputs = this.get('channel').data.inputs;
      const gains = channelInputs.map(c => {
        let gain = c.data.gain;

        if (channelInputs.some(channelInput => channelInput.data.isSolo)) gain = 0;
        if (c.data.isSolo) gain = c.data.gain;
        if (c.data.isMuted) gain = 0;

        return {
          channelId: c.data.channelId,
          gain
        };
      });

      const message = {
        seqId: SequenceIds.CHANGE_AUX_VOLUME_INPUTS,
        data: {
          gains
        }
      };

      debounce(this.get('connection'), this.get('connection').sendMessage, message, DEBOUNCE_TIME);
    }
  },

  _getGainSequenceId() {
    if (this.get('isAuxiliaryOutput')) return SequenceIds.CHANGE_AUX_VOLUME_OUTPUT;
    if (this.get('isMasterOutput')) return SequenceIds.CHANGE_MAIN_VOLUME_OUTPUT;
    if (this.get('isAuxiliaryInput')) return SequenceIds.CHANGE_AUX_VOLUME_INPUT;

    return SequenceIds.CHANGE_MAIN_VOLUME_INPUT;
  }
});
