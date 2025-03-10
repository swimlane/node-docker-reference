import {
  anchoredIdentifierRegexp,
  anchoredNameRegexp,
  referenceRegexp,
} from "./regexp";
import { isDigest, validateDigest } from "./digest";
import { Reference, ReferenceOptions, ReferenceType } from "./reference";

const NAME_MAX_LENGTH = 255;

class InvalidReferenceFormatError extends Error {
  constructor() {
    super("invalid reference format");
    this.name = "InvalidReferenceFormatError";
  }
}

class NameContainsUppercaseError extends Error {
  constructor() {
    super("repository name must be lowercase");
    this.name = "NameContainsUppercaseError";
  }
}

class EmptyNameError extends Error {
  constructor() {
    super("repository name must have at least one component");
    this.name = "EmptyNameError";
  }
}

class NameTooLongError extends Error {
  constructor() {
    super(
      `repository name must not be more than ${NAME_MAX_LENGTH} characters`
    );
    this.name = "NameTooLongError";
  }
}

const DEFAULT_DOMAIN = "docker.io";
const LEGACY_DEFAULT_DOMAIN = "index.docker.io";
const OFFICIAL_REPOSITORY_NAME = "library";

function _parseQualifiedName(regexp: RegExp, name: string) {
  const matches = regexp.exec(name);

  if (!matches) {
    if (name === "") {
      throw new EmptyNameError();
    }

    if (regexp.test(name.toLowerCase())) {
      throw new NameContainsUppercaseError();
    }

    throw new InvalidReferenceFormatError();
  }

  if (matches[1].length > NAME_MAX_LENGTH) {
    throw new NameTooLongError();
  }

  let reference: ReferenceOptions;

  const nameMatch = anchoredNameRegexp.exec(matches[1]);
  if (nameMatch && nameMatch.length === 3) {
    reference = {
      domain: nameMatch[1],
      repository: nameMatch[2],
    };
  } else {
    reference = {
      domain: "",
      repository: matches[1],
    };
  }

  reference.tag = matches[2] as ReferenceType;

  if (matches[3]) {
    validateDigest(matches[3]);
    reference.digest = matches[3];
  }

  return new Reference(reference);
}

// noinspection JSUnusedGlobalSymbols
const parseQualifiedNameOptimized = (name: string) => {
  return _parseQualifiedName(new RegExp(referenceRegexp), name);
};

const parseQualifiedName = (name: string) => {
  return _parseQualifiedName(referenceRegexp, name);
};

function splitDockerDomain(name: string) {
  let domain;
  let reminder;

  const indexOfSlash = name.indexOf("/");
  if (
    indexOfSlash === -1 ||
    !(
      name.lastIndexOf(".", indexOfSlash) !== -1 ||
      name.lastIndexOf(":", indexOfSlash) !== -1 ||
      name.startsWith("localhost/")
    )
  ) {
    domain = DEFAULT_DOMAIN;
    reminder = name;
  } else {
    domain = name.substring(0, indexOfSlash);
    reminder = name.substring(indexOfSlash + 1);
  }

  if (domain === LEGACY_DEFAULT_DOMAIN) {
    domain = DEFAULT_DOMAIN;
  }

  if (domain === DEFAULT_DOMAIN && !reminder.includes("/")) {
    reminder = `${OFFICIAL_REPOSITORY_NAME}/${reminder}`;
  }

  return [domain, reminder];
}

const parseFamiliarName = (
  name: string,
  parseQualifiedNameFunc?: (name: string) => Reference
) => {
  if (anchoredIdentifierRegexp.test(name)) {
    throw new TypeError(
      `invalid repository name (${name}),` +
        `cannot specify 64-byte hexadecimal strings`
    );
  }

  const [domain, remainder] = splitDockerDomain(name);

  let remoteName;
  const tagSeparatorIndex = remainder.indexOf(":");
  if (tagSeparatorIndex > -1) {
    remoteName = remainder.substring(0, tagSeparatorIndex);
  } else {
    remoteName = remainder;
  }

  if (remoteName.toLowerCase() !== remoteName) {
    throw new TypeError(
      `invalid reference format: repository name must be lowercase`
    );
  }

  if (parseQualifiedNameFunc) {
    // ability to define custom park func , we have performance
    // issue with old one, and we need a way to override
    // it for prevent use js native regexp
    return parseQualifiedNameFunc(`${domain}/${remainder}`);
  }

  return parseQualifiedName(`${domain}/${remainder}`);
};

// noinspection JSUnusedGlobalSymbols
const parseAll = (name: string) => {
  if (anchoredIdentifierRegexp.test(name)) {
    return new Reference({ digest: `sha256:${name}` });
  }

  if (isDigest(name)) {
    return new Reference({ digest: name });
  }

  return parseFamiliarName(name);
};

export {
  parseQualifiedNameOptimized,
  parseQualifiedName,
  parseFamiliarName,
  parseAll,
};
