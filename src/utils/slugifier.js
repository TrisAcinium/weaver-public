const generateSlug = (virtualRelPath, unique = true) => {
  const filename = virtualRelPath.split('/').pop();
  const coreName = filename.includes('.') ? filename.split('.')[0] : filename;

  let parts = virtualRelPath
    .replace(/\\/g, '/')
    .split('/');
  parts[parts.length - 1] = coreName;

  parts = parts
    .map(part => part.trim().toLowerCase().replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-+|-+$/g, ''))
    .filter(Boolean);
  return unique ? parts.join('--') : parts[parts.length - 1];
};

module.exports = { generateSlug };
