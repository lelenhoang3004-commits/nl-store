import { notifyError, notifyInfo, notifySuccess, notifyWarning, showNotification } from "../../../assets/js/notify.js";

export const toast = {
  success(message, options = {}) {
    return notifySuccess(message, options);
  },
  error(message, options = {}) {
    return notifyError(message, options);
  },
  warning(message, options = {}) {
    return notifyWarning(message, options);
  },
  info(message, options = {}) {
    return notifyInfo(message, options);
  }
};

export { showNotification };
