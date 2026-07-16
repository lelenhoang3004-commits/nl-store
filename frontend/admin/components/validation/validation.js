const VALIDATION_MESSAGE_CLASS = "validation-message";
const VALIDATION_SUMMARY_SELECTOR = "[data-validation-summary]";

export const validators = {
  required(value, field) {
    if (isFileField(field)) {
      return field.files.length > 0;
    }

    return value.trim().length > 0;
  },

  email(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
  },

  phone(value) {
    return /^(0|\+84)(\s|\.)?([0-9]{2,3})(\s|\.)?([0-9]{3})(\s|\.)?([0-9]{3,4})$/.test(value.trim());
  },

  password(value) {
    return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(value);
  },

  number(value) {
    return Number.isFinite(toNumber(value));
  },

  price(value) {
    const number = toNumber(value);
    return Number.isFinite(number) && number >= 0;
  },

  image(_value, field) {
    if (!isFileField(field) || field.files.length === 0) {
      return true;
    }

    return Array.from(field.files).every((file) => file.type.startsWith("image/"));
  },

  fileSize(_value, field, maxSizeInMb = 2) {
    if (!isFileField(field) || field.files.length === 0) {
      return true;
    }

    const maxBytes = Number(maxSizeInMb) * 1024 * 1024;
    return Array.from(field.files).every((file) => file.size <= maxBytes);
  },

  min(value, field, limit) {
    const minValue = Number(limit);

    if (shouldCompareAsNumber(field)) {
      const number = toNumber(value);
      return Number.isFinite(number) && number >= minValue;
    }

    return value.trim().length >= minValue;
  },

  max(value, field, limit) {
    const maxValue = Number(limit);

    if (shouldCompareAsNumber(field)) {
      const number = toNumber(value);
      return Number.isFinite(number) && number <= maxValue;
    }

    return value.trim().length <= maxValue;
  },

  regex(value, _field, pattern) {
    if (!pattern) {
      return true;
    }

    return new RegExp(pattern).test(value);
  }
};

const defaultMessages = {
  required: "{label} là bắt buộc.",
  email: "{label} chưa đúng định dạng email.",
  phone: "{label} chưa đúng định dạng số điện thoại.",
  password: "{label} cần ít nhất 8 ký tự, gồm chữ hoa, chữ thường và số.",
  number: "{label} phải là số hợp lệ.",
  price: "{label} phải là giá trị tiền hợp lệ.",
  image: "{label} chỉ chấp nhận tệp hình ảnh.",
  fileSize: "{label} không được vượt quá {param}MB.",
  min: "{label} phải có giá trị tối thiểu {param}.",
  max: "{label} không được vượt quá {param}.",
  regex: "{label} không đúng định dạng yêu cầu."
};

export function bindValidation(form, options = {}) {
  if (!form) {
    return;
  }

  const fields = getValidationFields(form);

  fields.forEach((field) => {
    field.addEventListener("blur", () => validateField(field));
    field.addEventListener("change", () => validateField(field));

    if (options.validateOnInput !== false) {
      field.addEventListener("input", () => {
        if (field.classList.contains("is-invalid")) {
          validateField(field);
        }
      });
    }
  });
}

export function validateForm(form) {
  const fields = getValidationFields(form);
  const errors = [];

  fields.forEach((field) => {
    const result = validateField(field);

    if (!result.isValid) {
      errors.push({
        field,
        message: result.message
      });
    }
  });

  updateSummary(form, errors);

  if (errors.length > 0) {
    errors[0].field.focus({ preventScroll: false });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

export function validateField(field) {
  const rules = parseRules(field.dataset.validate);
  const value = getFieldValue(field);
  const hasRequiredRule = rules.some((rule) => rule.name === "required");

  if (!hasRequiredRule && isEmptyValue(value, field)) {
    clearFieldError(field);
    return { isValid: true, message: "" };
  }

  for (const rule of rules) {
    const validator = validators[rule.name];

    if (!validator) {
      continue;
    }

    const isValid = validator(value, field, rule.param);

    if (!isValid) {
      const message = resolveMessage(field, rule);
      showFieldError(field, message);
      return { isValid: false, message };
    }
  }

  clearFieldError(field, true);
  return { isValid: true, message: "" };
}

export function clearValidation(form) {
  getValidationFields(form).forEach((field) => clearFieldError(field));
  updateSummary(form, []);
}

function getValidationFields(form) {
  return Array.from(form.querySelectorAll("[data-validate]"));
}

function parseRules(ruleString = "") {
  return ruleString
    .split("|")
    .map((rule) => rule.trim())
    .filter(Boolean)
    .map((rule) => {
      const separatorIndex = rule.indexOf(":");

      if (separatorIndex === -1) {
        return { name: rule, param: undefined };
      }

      return {
        name: rule.slice(0, separatorIndex),
        param: rule.slice(separatorIndex + 1)
      };
    });
}

function resolveMessage(field, rule) {
  const label = field.dataset.label || findFieldLabel(field) || "Trường này";
  const customMessage = field.dataset[`${rule.name}Message`];
  const template = customMessage || defaultMessages[rule.name] || "{label} không hợp lệ.";

  return template
    .replaceAll("{label}", label)
    .replaceAll("{param}", rule.param ?? "");
}

function showFieldError(field, message) {
  const messageElement = getOrCreateMessageElement(field);

  field.classList.add("is-invalid");
  field.classList.remove("is-valid");
  field.setAttribute("aria-invalid", "true");
  field.setAttribute("aria-describedby", messageElement.id);
  messageElement.replaceChildren(createMessageIcon(), createMessageText(message));
}

function clearFieldError(field, markValid = false) {
  const messageElement = getMessageElement(field);

  field.classList.remove("is-invalid");
  field.removeAttribute("aria-invalid");
  field.removeAttribute("aria-describedby");

  if (markValid && !isEmptyValue(getFieldValue(field), field)) {
    field.classList.add("is-valid");
  } else {
    field.classList.remove("is-valid");
  }

  messageElement?.remove();
}

function getOrCreateMessageElement(field) {
  const existingMessage = getMessageElement(field);

  if (existingMessage) {
    return existingMessage;
  }

  const messageElement = document.createElement("p");
  messageElement.className = VALIDATION_MESSAGE_CLASS;
  messageElement.id = `${field.name || field.id || "field"}-${createUniqueId()}-error`;

  const wrapper = field.closest(".validation-field") || field.parentElement;
  wrapper?.appendChild(messageElement);

  return messageElement;
}

function getMessageElement(field) {
  const wrapper = field.closest(".validation-field") || field.parentElement;
  return wrapper?.querySelector(`.${VALIDATION_MESSAGE_CLASS}`);
}

function updateSummary(form, errors) {
  const summary = form.querySelector(VALIDATION_SUMMARY_SELECTOR);

  if (!summary) {
    return;
  }

  summary.classList.toggle("is-visible", errors.length > 0);
  summary.textContent = errors.length > 0
    ? `Có ${errors.length} trường cần kiểm tra lại.`
    : "";
}

function findFieldLabel(field) {
  const directLabel = field.closest("label")?.querySelector("span")?.textContent?.trim();

  if (directLabel) {
    return directLabel;
  }

  if (field.id) {
    return document.querySelector(`label[for="${field.id}"]`)?.textContent?.trim();
  }

  return "";
}

function getFieldValue(field) {
  if (isFileField(field)) {
    return field.files.length ? field.files[0].name : "";
  }

  return field.value ?? "";
}

function isEmptyValue(value, field) {
  return isFileField(field) ? field.files.length === 0 : value.trim().length === 0;
}

function isFileField(field) {
  return field.type === "file";
}

function shouldCompareAsNumber(field) {
  const rules = field.dataset.validate || "";
  return field.type === "number" || rules.includes("number") || rules.includes("price");
}

function toNumber(value) {
  if (typeof value !== "string") {
    return Number(value);
  }

  const normalized = value
    .replace(/\s/g, "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");

  return Number(normalized);
}

function createUniqueId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createMessageIcon() {
  const icon = document.createElement("i");
  icon.className = "fa-solid fa-circle-exclamation";
  icon.setAttribute("aria-hidden", "true");
  return icon;
}

function createMessageText(message) {
  const text = document.createElement("span");
  text.textContent = message;
  return text;
}
