import { pingico } from './pingico';
function getDroppedFiles(event: DragEvent): File[] {
  event.preventDefault();
  if (!event.dataTransfer) {
    return [];
  }
  if (event.dataTransfer.items) {
    return [...event.dataTransfer.items]
      .filter((item) => {
        return item && item.kind === 'file';
      })
      .map((item) => {
        return item.getAsFile();
      }) as File[];
  }
  return [...event.dataTransfer.files];
}

function filterFiles(files: File[]) {
  return files.filter((file) => {
    return file.type === 'image/png';
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const files: File[] = [];

  const updateDownload = ((button) => {
    button.addEventListener('click', async () => {
      console.log(files);
      pingico(...files).then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = files.length === 1 ? 'icon.ico' : 'icons.ico';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });
    });

    return () => {
      if (files.length === 1) {
        button.textContent = 'Download icon';
        button.disabled = false;
      } else if (1 < files.length) {
        button.textContent = `Download multi-icons(${files.length})`;
        button.disabled = false;
      } else {
        button.textContent = 'Download';
        button.disabled = true;
      }
    };
  })(document.getElementById('download') as HTMLButtonElement);

  updateDownload();

  const convertImage = ((parent, reset) => {
    reset.addEventListener('click', () => {
      files.splice(0, files.length);
      updateDownload();
      while (parent.firstChild) {
        parent.removeChild(parent.firstChild);
      }
    });

    return (file: File) => {
      files.push(file);
      updateDownload();
      const image = document.createElement('img');
      image.src = URL.createObjectURL(file);
      parent.appendChild(image);
    };
  })(
    document.getElementById('icons') as HTMLElement,
    document.getElementById('reset') as HTMLButtonElement,
  );

  ((input) => {
    input.addEventListener('change', (event) => {
      const files = filterFiles(input.files ? [...input.files] : []);
      files.forEach(convertImage);
    });
  })(document.getElementById('images') as HTMLInputElement);

  document.body.ondrop = (event) => {
    event.preventDefault();
    const files = filterFiles(getDroppedFiles(event));
    files.forEach(convertImage);
  };
  document.body.ondragover = (event) => {
    event.preventDefault();
  };
});
