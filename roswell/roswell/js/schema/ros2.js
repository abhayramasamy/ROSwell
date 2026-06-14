/* js/schema/ros2.js — ROS2 registries (populated in future phases) */
window.ROS2Schema = (() => {
  const TOPIC_LIST     = [];   /* { name, msgType } — populated when topics are configured */
  const SERVER_LIST    = [];   /* { name, srvType } */
  const AC_SERVER_LIST = [];   /* { name, actionType } */

  const QOS_PROFILES = ['default', 'sensor_data', 'services_default', 'parameters', 'parameter_events'];
  const LANGUAGES    = [{ value: 'cpp', label: 'C++' }, { value: 'python', label: 'Python' }];
  const SPIN_MODES   = ['spin', 'spin_some', 'spin_until_future_complete'];
  const CBG_TYPES    = ['MutuallyExclusive', 'Reentrant'];
  const EXEC_MODELS  = [{ value: 'single', label: 'SingleThreadedExecutor' }, { value: 'multi', label: 'MultiThreadedExecutor' }];

  return { TOPIC_LIST, SERVER_LIST, AC_SERVER_LIST, QOS_PROFILES, LANGUAGES, SPIN_MODES, CBG_TYPES, EXEC_MODELS };
})();
