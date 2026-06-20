/* js/schema/ros2.js — ROS2 registries and QoS definitions */
window.ROS2Schema = (() => {
  const TOPIC_LIST     = [];
  const SERVER_LIST    = [];
  const AC_SERVER_LIST = [];

  /* Built-in named QoS presets (from rclpy / ROS2 docs) */
  const BUILTIN_QOS = {
    'default': {
      label:       'Default',
      reliability: 'RELIABLE',
      durability:  'VOLATILE',
      history:     'KEEP_LAST',
      depth:       10,
      deadline:    0,
      liveliness:  'AUTOMATIC',
    },
    'sensor_data': {
      label:       'Sensor Data',
      reliability: 'BEST_EFFORT',
      durability:  'VOLATILE',
      history:     'KEEP_LAST',
      depth:       5,
      deadline:    0,
      liveliness:  'AUTOMATIC',
    },
    'services_default': {
      label:       'Services Default',
      reliability: 'RELIABLE',
      durability:  'VOLATILE',
      history:     'KEEP_LAST',
      depth:       10,
      deadline:    0,
      liveliness:  'AUTOMATIC',
    },
    'parameters': {
      label:       'Parameters',
      reliability: 'RELIABLE',
      durability:  'VOLATILE',
      history:     'KEEP_LAST',
      depth:       1000,
      deadline:    0,
      liveliness:  'AUTOMATIC',
    },
    'parameter_events': {
      label:       'Parameter Events',
      reliability: 'RELIABLE',
      durability:  'VOLATILE',
      history:     'KEEP_LAST',
      depth:       1000,
      deadline:    0,
      liveliness:  'AUTOMATIC',
    },
  };

  /* Compatibility rules (rclpy docs):
     Publisher reliability must be >= subscriber reliability
       RELIABLE > BEST_EFFORT
     Publisher durability must be >= subscriber durability
       TRANSIENT_LOCAL > VOLATILE
  */
  function qosCompatibilityWarnings(pubQos, subQos) {
    const warnings = [];
    if (pubQos.reliability === 'BEST_EFFORT' && subQos.reliability === 'RELIABLE') {
      warnings.push('Publisher is BEST_EFFORT but subscriber is RELIABLE — connection will be INCOMPATIBLE (no data received).');
    }
    if (pubQos.durability === 'VOLATILE' && subQos.durability === 'TRANSIENT_LOCAL') {
      warnings.push('Publisher is VOLATILE but subscriber is TRANSIENT_LOCAL — subscriber will not receive messages published before it connected.');
    }
    return warnings;
  }

  function resolveQos(qosId) {
    if (!qosId || qosId === 'default') return BUILTIN_QOS['default'];
    if (BUILTIN_QOS[qosId]) return BUILTIN_QOS[qosId];
    const custom = Object.values((window.Store?.getState()?.qosProfiles) || {}).find(p => p.id === qosId);
    return custom || BUILTIN_QOS['default'];
  }

  const QOS_PROFILES = Object.keys(BUILTIN_QOS);
  const LANGUAGES    = [{ value: 'cpp', label: 'C++' }, { value: 'python', label: 'Python' }];
  const SPIN_MODES   = ['spin', 'spin_some', 'spin_until_future_complete'];
  const CBG_TYPES    = ['MutuallyExclusive', 'Reentrant'];
  const EXEC_MODELS  = [{ value: 'single', label: 'SingleThreadedExecutor' }, { value: 'multi', label: 'MultiThreadedExecutor' }];

  return { TOPIC_LIST, SERVER_LIST, AC_SERVER_LIST, QOS_PROFILES, BUILTIN_QOS, LANGUAGES, SPIN_MODES, CBG_TYPES, EXEC_MODELS, qosCompatibilityWarnings, resolveQos };
})();
