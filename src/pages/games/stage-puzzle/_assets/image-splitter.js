(function () {
  function loadImage(source) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("无法读取所选图片"));
      image.src = source;
    });
  }

  async function splitImage(source, size) {
    if (!Number.isInteger(size) || size < 2) throw new Error("拼图边长必须是不小于 2 的整数");
    const image = await loadImage(source);
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    const tiles = [];
    for (let row = 0; row < size; row += 1) {
      for (let column = 0; column < size; column += 1) {
        tiles.push({
          id: row * size + column, row, column, source,
          sourceX: column * width / size,
          sourceY: row * height / size,
          sourceWidth: width / size,
          sourceHeight: height / size,
          backgroundSize: `${size * 100}% ${size * 100}%`,
          backgroundPosition: `${column / (size - 1) * 100}% ${row / (size - 1) * 100}%`,
        });
      }
    }
    return { source, width, height, aspectRatio: width / height, size, tiles };
  }

  window.ImageSplitter = { splitImage };
})();
