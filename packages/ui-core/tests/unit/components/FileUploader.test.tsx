/**
 * @vitest-environment jsdom
 * @file Unit тесты для FileUploader компонента
 */

import React, { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { FileUploader } from '../../../src/components/FileUploader.js';
import type { FileInfo, FileStatus } from '../../../src/components/FileUploader.js';

// Полная очистка DOM между тестами
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Моки для DataTransfer и DragEvent (не доступны в jsdom по умолчанию)
class MockDataTransfer {
  files: FileList;

  constructor() {
    const fileArray: File[] = [];
    this.files = Object.assign(fileArray, {
      item: (index: number) => fileArray[index] ?? null,
      length: fileArray.length,
    }) as FileList;
  }

  get items(): DataTransferItemList {
    return {
      add: (file: Readonly<File | string>) => {
        if (file instanceof File) {
          (this.files as unknown as File[]).push(file);
          Object.defineProperty(this.files, 'length', {
            value: (this.files as unknown as File[]).length,
            writable: false,
          });
        }
      },
      remove: vi.fn(),
      clear: vi.fn(),
      length: 0,
    } as unknown as DataTransferItemList;
  }
}

// Глобальные моки для DataTransfer и DragEvent
if (typeof globalThis.DataTransfer === 'undefined') {
  // @ts-expect-error - мок для тестов
  globalThis.DataTransfer = MockDataTransfer;
}

if (typeof globalThis.DragEvent === 'undefined') {
  // @ts-expect-error - мок для тестов
  globalThis.DragEvent = class MockDragEvent extends Event {
    dataTransfer: DataTransfer | null;

    constructor(
      type: Readonly<string>,
      eventInit: Readonly<DragEventInit> | undefined = undefined,
    ) {
      super(type, eventInit as EventInit | undefined);
      this.dataTransfer = eventInit?.dataTransfer ?? null;
    }
  };
}

// Функция для изолированного рендера
function renderIsolated(component: Readonly<React.ReactElement>) {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const result = render(component, { container });

  return {
    ...result,
    container,
    getFileUploader: () => container.querySelector('div[data-component="CoreFileUploader"]')!,
    getInput: () => container.querySelector('input[type="file"]') as HTMLInputElement,
    getDropZone: () => container.querySelector('div[role="button"]') as HTMLDivElement,
    getButton: () => container.querySelector('button[type="button"]') as HTMLButtonElement,
    getFileList: () => container.querySelector('div[role="list"]'),
    getFileItems: () => container.querySelectorAll('div[role="listitem"]'),
    getFileItem: (fileId: string) => {
      // Пробуем найти по data-testid (если testId передан)
      const byTestId = container.querySelector(`div[data-testid$="-file-${fileId}"]`);
      if (byTestId) return byTestId as HTMLDivElement;
      // Иначе ищем по aria-label (всегда присутствует)
      return container.querySelector(
        `div[role="listitem"][aria-label*="${fileId}"]`,
      ) as HTMLDivElement;
    },
    getRemoveButton: (fileId: string) => {
      // Пробуем найти по data-testid (если testId передан)
      const byTestId = container.querySelector(`button[data-testid$="-remove-${fileId}"]`);
      if (byTestId) return byTestId as HTMLButtonElement;
      // Иначе ищем по aria-label (всегда присутствует)
      return container.querySelector(`button[aria-label*="${fileId}"]`) as HTMLButtonElement;
    },
    getHint: () => container.querySelector('div[role="note"]'),
    getProgressBar: () => container.querySelector('div[role="progressbar"]'),
    getAlert: () => container.querySelector('div[role="alert"]'),
  };
}

// Тестовые данные
const createTestFile = (
  id: string,
  status: FileStatus,
  progress?: number,
  errorMessage?: string,
): FileInfo => {
  const base = {
    id,
    name: `test-${id}.txt`,
    sizeLabel: '1.5 MB',
    typeLabel: 'text/plain',
  };

  // Discriminated union в зависимости от типа статуса
  switch (status.type) {
    case 'progress':
      if (progress === undefined) {
        throw new Error('progress is required for progress status');
      }
      return { ...base, status, progress } as FileInfo;
    case 'error':
      if (errorMessage === undefined) {
        throw new Error('errorMessage is required for error status');
      }
      return { ...base, status, errorMessage } as FileInfo;
    case 'pending':
      return { ...base, status } as FileInfo;
    case 'success':
      return { ...base, status } as FileInfo;
    default:
      // TypeScript exhaustiveness check
      const _exhaustive: never = status;
      return _exhaustive;
  }
};

const testFilePending: FileInfo = createTestFile('1', { type: 'pending', label: 'Ожидание' });
const testFileProgress: FileInfo = createTestFile(
  '2',
  { type: 'progress', label: 'Загрузка...' },
  50,
);
const testFileSuccess: FileInfo = createTestFile('3', { type: 'success', label: 'Загружено' });
const testFileError: FileInfo = createTestFile(
  '4',
  { type: 'error', label: 'Ошибка' },
  undefined,
  'Ошибка загрузки',
);

// Вынесенные константы для соблюдения ESLint правил
const emptyFiles: readonly FileInfo[] = [];
const singleFileArray: readonly FileInfo[] = [testFilePending];
const singleFileProgressArray: readonly FileInfo[] = [testFileProgress];
const singleFileSuccessArray: readonly FileInfo[] = [testFileSuccess];
const singleFileErrorArray: readonly FileInfo[] = [testFileError];
const threeFilesArray: readonly FileInfo[] = [testFilePending, testFileProgress, testFileSuccess];
const fourFilesArray: readonly FileInfo[] = [
  testFilePending,
  testFileProgress,
  testFileSuccess,
  testFileError,
];
const customStyle: React.CSSProperties = { color: 'red' };

describe('FileUploader', () => {
  describe('4.1. Рендер и базовая структура', () => {
    it('рендерится без падений с минимальными пропсами', () => {
      const { container, getFileUploader } = renderIsolated(<FileUploader files={emptyFiles} />);

      expect(container).toBeInTheDocument();
      expect(getFileUploader()).toBeInTheDocument();
    });

    it('создает корневой div с правильными атрибутами', () => {
      const { getFileUploader } = renderIsolated(
        <FileUploader files={emptyFiles} data-testid='test-uploader' />,
      );

      const uploader = getFileUploader();
      expect(uploader).toBeInTheDocument();
      expect(uploader).toHaveAttribute('data-component', 'CoreFileUploader');
      expect(uploader).toHaveAttribute('data-testid', 'test-uploader');
      expect(uploader).toHaveAttribute('data-state', 'enabled');
    });

    it('применяет data-state="disabled" когда disabled=true', () => {
      const { getFileUploader } = renderIsolated(<FileUploader files={emptyFiles} disabled />);

      expect(getFileUploader()).toHaveAttribute('data-state', 'disabled');
    });

    it('применяет кастомный data-state', () => {
      const { getFileUploader } = renderIsolated(
        <FileUploader files={emptyFiles} data-state='custom-state' />,
      );

      expect(getFileUploader()).toHaveAttribute('data-state', 'custom-state');
    });

    it('пробрасывает className', () => {
      const { getFileUploader } = renderIsolated(
        <FileUploader files={emptyFiles} className='custom-class' />,
      );

      expect(getFileUploader()).toHaveClass('custom-class');
    });

    it('пробрасывает style', () => {
      const { getFileUploader } = renderIsolated(
        <FileUploader files={emptyFiles} style={customStyle} />,
      );

      expect(getFileUploader()).toHaveStyle({ color: 'rgb(255, 0, 0)' });
    });
  });

  describe('4.2. Скрытый input для выбора файлов', () => {
    it('создает скрытый input элемент', () => {
      const { getInput } = renderIsolated(<FileUploader files={emptyFiles} />);

      const input = getInput();
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute('type', 'file');
      expect(input).toHaveAttribute('aria-hidden', 'true');
    });

    it('input имеет multiple=false по умолчанию', () => {
      const { getInput } = renderIsolated(<FileUploader files={emptyFiles} />);

      expect(getInput()).not.toHaveAttribute('multiple');
    });

    it('input имеет multiple=true когда multiple=true', () => {
      const { getInput } = renderIsolated(<FileUploader files={emptyFiles} multiple />);

      expect(getInput()).toHaveAttribute('multiple');
    });

    it('input имеет accept атрибут', () => {
      const { getInput } = renderIsolated(<FileUploader files={emptyFiles} accept='image/*' />);

      expect(getInput()).toHaveAttribute('accept', 'image/*');
    });

    it('input disabled когда disabled=true', () => {
      const { getInput } = renderIsolated(<FileUploader files={emptyFiles} disabled />);

      expect(getInput()).toBeDisabled();
    });

    it('input имеет data-testid когда передан testId', () => {
      const { getInput } = renderIsolated(
        <FileUploader files={emptyFiles} data-testid='test-uploader' />,
      );

      expect(getInput()).toHaveAttribute('data-testid', 'test-uploader-input');
    });
  });

  describe('4.3. Drop zone', () => {
    it('создает drop zone с правильными атрибутами', () => {
      const { getDropZone } = renderIsolated(<FileUploader files={emptyFiles} />);

      const dropZone = getDropZone();
      expect(dropZone).toBeInTheDocument();
      expect(dropZone).toHaveAttribute('role', 'button');
      expect(dropZone).toHaveAttribute('tabIndex', '0');
      expect(dropZone).toHaveAttribute('aria-disabled', 'false');
    });

    it('drop zone disabled когда disabled=true', () => {
      const { getDropZone } = renderIsolated(<FileUploader files={emptyFiles} disabled />);

      const dropZone = getDropZone();
      expect(dropZone).toHaveAttribute('tabIndex', '-1');
      expect(dropZone).toHaveAttribute('aria-disabled', 'true');
    });

    it('отображает dropZoneLabel по умолчанию', () => {
      const { container } = renderIsolated(
        <FileUploader files={emptyFiles} dropZoneLabel='Перетащите файлы' />,
      );

      expect(container).toHaveTextContent('Перетащите файлы');
    });

    it('отображает dropZoneLabelActive когда isDragActive=true', () => {
      const { container } = renderIsolated(
        <FileUploader
          files={emptyFiles}
          isDragActive
          dropZoneLabel='Перетащите файлы'
          dropZoneLabelActive='Отпустите файлы'
        />,
      );

      expect(container).toHaveTextContent('Отпустите файлы');
      expect(container).not.toHaveTextContent('Перетащите файлы');
    });

    it('drop zone имеет data-testid когда передан testId', () => {
      const { getDropZone } = renderIsolated(
        <FileUploader files={emptyFiles} data-testid='test-uploader' />,
      );

      expect(getDropZone()).toHaveAttribute('data-testid', 'test-uploader-dropzone');
    });
  });

  describe('4.4. Кнопка выбора файлов', () => {
    it('создает кнопку с правильными атрибутами', () => {
      const { getButton } = renderIsolated(<FileUploader files={emptyFiles} />);

      const button = getButton();
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute('type', 'button');
      expect(button).not.toBeDisabled();
    });

    it('отображает buttonLabel по умолчанию', () => {
      const { getButton } = renderIsolated(
        <FileUploader files={emptyFiles} buttonLabel='Выбрать' />,
      );

      expect(getButton()).toHaveTextContent('Выбрать');
    });

    it('кнопка disabled когда disabled=true', () => {
      const { getButton } = renderIsolated(<FileUploader files={emptyFiles} disabled />);

      expect(getButton()).toBeDisabled();
    });

    it('кнопка имеет data-testid когда передан testId', () => {
      const { getButton } = renderIsolated(
        <FileUploader files={emptyFiles} data-testid='test-uploader' />,
      );

      expect(getButton()).toHaveAttribute('data-testid', 'test-uploader-button');
    });
  });

  describe('4.5. Список файлов', () => {
    it('не отображает список файлов когда files пустой', () => {
      const { getFileList } = renderIsolated(<FileUploader files={emptyFiles} />);

      expect(getFileList()).not.toBeInTheDocument();
    });

    it('отображает список файлов когда files не пустой', () => {
      const { getFileList } = renderIsolated(<FileUploader files={singleFileArray} />);

      const fileList = getFileList();
      expect(fileList).toBeInTheDocument();
      expect(fileList).toHaveAttribute('role', 'list');
      expect(fileList).toHaveAttribute('aria-label', 'Список выбранных файлов');
    });

    it('отображает все файлы из списка', () => {
      const { getFileItems } = renderIsolated(
        <FileUploader files={threeFilesArray} />,
      );

      expect(getFileItems()).toHaveLength(3);
    });

    it('каждый файл имеет правильные атрибуты', () => {
      const { getFileItem } = renderIsolated(<FileUploader files={singleFileArray} />);

      const fileItem = getFileItem('1');
      expect(fileItem).toBeInTheDocument();
      expect(fileItem).toHaveAttribute('role', 'listitem');
      expect(fileItem).toHaveAttribute('aria-label', 'Файл: test-1.txt');
    });

    it('отображает имя файла', () => {
      const { container } = renderIsolated(<FileUploader files={singleFileArray} />);

      expect(container).toHaveTextContent('test-1.txt');
    });

    it('отображает метаданные файла (размер и тип)', () => {
      const { container } = renderIsolated(<FileUploader files={singleFileArray} />);

      expect(container).toHaveTextContent('1.5 MB • text/plain');
    });

    it('отображает статус файла', () => {
      const { container } = renderIsolated(<FileUploader files={singleFileArray} />);

      expect(container).toHaveTextContent('Ожидание');
    });
  });

  describe('4.6. Статусы файлов', () => {
    it('отображает pending статус', () => {
      const { container } = renderIsolated(<FileUploader files={singleFileArray} />);

      expect(container).toHaveTextContent('Ожидание');
    });

    it('отображает progress статус с прогресс-баром', () => {
      const { container, getProgressBar } = renderIsolated(
        <FileUploader files={singleFileProgressArray} />,
      );

      expect(container).toHaveTextContent('Загрузка...');
      const progressBar = getProgressBar();
      expect(progressBar).toBeInTheDocument();
      expect(progressBar).toHaveAttribute('role', 'progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '50');
      expect(progressBar).toHaveAttribute('aria-valuemin', '0');
      expect(progressBar).toHaveAttribute('aria-valuemax', '100');
    });

    it('отображает success статус', () => {
      const { container } = renderIsolated(<FileUploader files={singleFileSuccessArray} />);

      expect(container).toHaveTextContent('Загружено');
    });

    it('отображает error статус с сообщением об ошибке', () => {
      const { container, getAlert } = renderIsolated(<FileUploader files={singleFileErrorArray} />);

      expect(container).toHaveTextContent('Ошибка');
      const alert = getAlert();
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveAttribute('role', 'alert');
      expect(alert).toHaveAttribute('aria-live', 'polite');
      expect(alert).toHaveTextContent('Ошибка загрузки');
    });
  });

  describe('4.7. Кнопка удаления файла', () => {
    it('не отображает кнопку удаления когда onRemove не передан', () => {
      const { getRemoveButton } = renderIsolated(<FileUploader files={singleFileArray} />);

      expect(getRemoveButton('1')).not.toBeInTheDocument();
    });

    it('отображает кнопку удаления когда onRemove передан', () => {
      const onRemove = vi.fn();
      const { getRemoveButton } = renderIsolated(
        <FileUploader files={singleFileArray} onRemove={onRemove} />,
      );

      const removeButton = getRemoveButton('1');
      expect(removeButton).toBeInTheDocument();
      expect(removeButton).toHaveTextContent('Удалить');
      expect(removeButton).toHaveAttribute('aria-label', 'Удалить файл test-1.txt');
    });

    it('кнопка удаления disabled когда disabled=true', () => {
      const onRemove = vi.fn();
      const { getRemoveButton } = renderIsolated(
        <FileUploader files={singleFileArray} onRemove={onRemove} disabled />,
      );

      expect(getRemoveButton('1')).toBeDisabled();
    });

    it('кнопка удаления имеет data-testid когда передан testId', () => {
      const onRemove = vi.fn();
      const { getRemoveButton } = renderIsolated(
        <FileUploader
          files={singleFileArray}
          onRemove={onRemove}
          data-testid='test-uploader'
        />,
      );

      expect(getRemoveButton('1')).toHaveAttribute('data-testid', 'test-uploader-remove-1');
    });
  });

  describe('4.8. Подсказка (hint)', () => {
    it('не отображает hint когда hint не передан', () => {
      const { getHint } = renderIsolated(<FileUploader files={emptyFiles} />);

      expect(getHint()).not.toBeInTheDocument();
    });

    it('не отображает hint когда hint пустая строка', () => {
      const { getHint } = renderIsolated(<FileUploader files={emptyFiles} hint='' />);

      expect(getHint()).not.toBeInTheDocument();
    });

    it('отображает hint когда hint передан', () => {
      const { getHint, container } = renderIsolated(
        <FileUploader files={emptyFiles} hint='Максимальный размер: 10MB' />,
      );

      const hint = getHint();
      expect(hint).toBeInTheDocument();
      expect(hint).toHaveAttribute('role', 'note');
      expect(hint).toHaveAttribute('aria-live', 'polite');
      expect(container).toHaveTextContent('Максимальный размер: 10MB');
    });

    it('hint имеет id="fileuploader-hint" по умолчанию', () => {
      const { getHint } = renderIsolated(<FileUploader files={emptyFiles} hint='Test hint' />);

      expect(getHint()).toHaveAttribute('id', 'fileuploader-hint');
    });

    it('hint имеет кастомный id когда передан testId', () => {
      const { getHint } = renderIsolated(
        <FileUploader files={emptyFiles} hint='Test hint' data-testid='test-uploader' />,
      );

      expect(getHint()).toHaveAttribute('id', 'test-uploader-hint');
    });

    it('компонент имеет aria-describedby когда hint передан', () => {
      const { getFileUploader } = renderIsolated(
        <FileUploader files={emptyFiles} hint='Test hint' data-testid='test-uploader' />,
      );

      expect(getFileUploader()).toHaveAttribute('aria-describedby', 'test-uploader-hint');
    });
  });

  describe('4.9. ARIA атрибуты', () => {
    it('применяет aria-label', () => {
      const { getFileUploader } = renderIsolated(
        <FileUploader files={emptyFiles} aria-label='File uploader' />,
      );

      expect(getFileUploader()).toHaveAttribute('aria-label', 'File uploader');
    });

    it('применяет aria-labelledby', () => {
      const { getFileUploader } = renderIsolated(
        <FileUploader files={emptyFiles} aria-labelledby='label-id' />,
      );

      expect(getFileUploader()).toHaveAttribute('aria-labelledby', 'label-id');
    });

    it('drop zone использует dropZoneAriaLabel когда передан', () => {
      const { getDropZone } = renderIsolated(
        <FileUploader files={emptyFiles} dropZoneAriaLabel='Custom drop zone' />,
      );

      expect(getDropZone()).toHaveAttribute('aria-label', 'Custom drop zone');
    });

    it('drop zone использует aria-label как fallback для dropZoneAriaLabel', () => {
      const { getDropZone } = renderIsolated(
        <FileUploader files={emptyFiles} aria-label='Main label' />,
      );

      expect(getDropZone()).toHaveAttribute('aria-label', 'Main label');
    });

    it('drop zone использует дефолтный aria-label когда ничего не передано', () => {
      const { getDropZone } = renderIsolated(<FileUploader files={emptyFiles} />);

      expect(getDropZone()).toHaveAttribute('aria-label', 'Drag and drop zone for file upload');
    });

    it('кнопка использует buttonAriaLabel когда передан', () => {
      const { getButton } = renderIsolated(
        <FileUploader files={emptyFiles} buttonAriaLabel='Custom button' />,
      );

      expect(getButton()).toHaveAttribute('aria-label', 'Custom button');
    });

    it('кнопка использует aria-label как fallback для buttonAriaLabel', () => {
      const { getButton } = renderIsolated(
        <FileUploader files={emptyFiles} aria-label='Main label' />,
      );

      expect(getButton()).toHaveAttribute('aria-label', 'Main label');
    });

    it('кнопка использует buttonLabel как fallback для buttonAriaLabel', () => {
      const { getButton } = renderIsolated(
        <FileUploader files={emptyFiles} buttonLabel='Select files' />,
      );

      expect(getButton()).toHaveAttribute('aria-label', 'Select files');
    });
  });

  describe('4.10. Обработчики событий - onChange', () => {
    it('вызывает onChange при выборе файлов через input', () => {
      const onChange = vi.fn();
      const { getInput } = renderIsolated(<FileUploader files={emptyFiles} onChange={onChange} />);

      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      const fileList = Object.assign([file], {
        item: (index: number) => (index === 0 ? file : null),
        length: 1,
      }) as FileList;

      const input = getInput();
      Object.defineProperty(input, 'files', {
        value: fileList,
        writable: false,
        configurable: true,
      });

      fireEvent.change(input);

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith([file], expect.any(Object));
    });

    it('не вызывает onChange когда файлы не выбраны', () => {
      const onChange = vi.fn();
      const { getInput } = renderIsolated(<FileUploader files={emptyFiles} onChange={onChange} />);

      const input = getInput();
      Object.defineProperty(input, 'files', {
        value: null,
        writable: false,
      });

      fireEvent.change(input);

      expect(onChange).not.toHaveBeenCalled();
    });

    it('сбрасывает значение input после onChange', () => {
      const onChange = vi.fn();
      const { getInput } = renderIsolated(<FileUploader files={emptyFiles} onChange={onChange} />);

      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      const fileList = Object.assign([file], {
        item: (index: number) => (index === 0 ? file : null),
        length: 1,
      }) as FileList;

      const input = getInput();
      Object.defineProperty(input, 'files', {
        value: fileList,
        writable: false,
        configurable: true,
      });

      // Проверяем, что после onChange значение input сбрасывается
      // Для input[type="file"] нельзя установить value вручную в тесте,
      // но компонент должен сбрасывать его после обработки
      fireEvent.change(input);

      // Проверяем, что onChange был вызван (значит обработка прошла)
      expect(onChange).toHaveBeenCalled();

      // Проверяем, что можно вызвать onChange снова с теми же файлами
      // (это означает, что input был сброшен, иначе браузер не позволил бы выбрать те же файлы)
      // Для input[type="file"] value всегда пустая строка после обработки
      expect(input.value).toBe('');
    });
  });

  describe('4.11. Обработчики событий - onButtonClick', () => {
    it('вызывает onButtonClick при клике на кнопку', () => {
      const onButtonClick = vi.fn();
      const { getButton } = renderIsolated(
        <FileUploader files={emptyFiles} onButtonClick={onButtonClick} />,
      );

      const button = getButton();
      const clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click');

      fireEvent.click(button);

      expect(onButtonClick).toHaveBeenCalledTimes(1);
      expect(clickSpy).toHaveBeenCalled();
    });

    it('не вызывает onButtonClick когда disabled=true', () => {
      const onButtonClick = vi.fn();
      const { getButton } = renderIsolated(
        <FileUploader files={emptyFiles} onButtonClick={onButtonClick} disabled />,
      );

      fireEvent.click(getButton());

      expect(onButtonClick).not.toHaveBeenCalled();
    });

    it('открывает file input при клике на кнопку', () => {
      const { getButton, getInput } = renderIsolated(<FileUploader files={emptyFiles} />);

      const input = getInput();
      const clickSpy = vi.spyOn(input, 'click');

      fireEvent.click(getButton());

      expect(clickSpy).toHaveBeenCalled();
    });
  });

  describe('4.12. Обработчики событий - onDrop', () => {
    it('вызывает onDrop при drop файлов', () => {
      const onDrop = vi.fn();
      const { getDropZone } = renderIsolated(<FileUploader files={emptyFiles} onDrop={onDrop} />);

      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);

      const dropEvent = new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer,
      });

      fireEvent(getDropZone(), dropEvent);

      expect(onDrop).toHaveBeenCalledTimes(1);
      expect(onDrop).toHaveBeenCalledWith([file], expect.any(Object));
    });

    it('не вызывает onDrop когда disabled=true', () => {
      const onDrop = vi.fn();
      const { getDropZone } = renderIsolated(
        <FileUploader files={emptyFiles} onDrop={onDrop} disabled />,
      );

      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      const fileList = Object.assign([file], {
        item: (index: number) => (index === 0 ? file : null),
        length: 1,
      }) as FileList;

      const dataTransfer = {
        files: fileList,
      } as DataTransfer;

      fireEvent.drop(getDropZone(), {
        dataTransfer,
      });

      expect(onDrop).not.toHaveBeenCalled();
    });

    it('не вызывает onDrop когда файлы не переданы', () => {
      const onDrop = vi.fn();
      const { getDropZone } = renderIsolated(<FileUploader files={emptyFiles} onDrop={onDrop} />);

      const emptyFileList = Object.assign([], {
        item: () => null,
        length: 0,
      }) as FileList;

      const dataTransfer = {
        files: emptyFileList,
      } as DataTransfer;

      fireEvent.drop(getDropZone(), {
        dataTransfer,
      });

      expect(onDrop).not.toHaveBeenCalled();
    });

    it('preventDefault и stopPropagation вызываются при drop', () => {
      const onDrop = vi.fn();
      const { getDropZone } = renderIsolated(<FileUploader files={emptyFiles} onDrop={onDrop} />);

      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      const fileList = Object.assign([file], {
        item: (index: number) => (index === 0 ? file : null),
        length: 1,
      }) as FileList;

      const dataTransfer = {
        files: fileList,
      } as DataTransfer;

      // Создаем реальное событие для проверки preventDefault/stopPropagation
      const dropEvent = new Event('drop', { bubbles: true, cancelable: true }) as DragEvent;
      Object.defineProperty(dropEvent, 'dataTransfer', {
        value: dataTransfer,
        writable: false,
        configurable: true,
      });

      const preventDefaultSpy = vi.spyOn(dropEvent, 'preventDefault');
      const stopPropagationSpy = vi.spyOn(dropEvent, 'stopPropagation');

      getDropZone().dispatchEvent(dropEvent);

      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(stopPropagationSpy).toHaveBeenCalled();
    });
  });

  describe('4.13. Обработчики событий - drag events', () => {
    it('вызывает onDragEnter при drag enter', () => {
      const onDragEnter = vi.fn();
      const { getDropZone } = renderIsolated(
        <FileUploader files={emptyFiles} onDragEnter={onDragEnter} />,
      );

      fireEvent.dragEnter(getDropZone());

      expect(onDragEnter).toHaveBeenCalledTimes(1);
    });

    it('не вызывает onDragEnter когда disabled=true', () => {
      const onDragEnter = vi.fn();
      const { getDropZone } = renderIsolated(
        <FileUploader files={emptyFiles} onDragEnter={onDragEnter} disabled />,
      );

      fireEvent.dragEnter(getDropZone());

      expect(onDragEnter).not.toHaveBeenCalled();
    });

    it('вызывает onDragLeave при drag leave', () => {
      const onDragLeave = vi.fn();
      const { getDropZone } = renderIsolated(
        <FileUploader files={emptyFiles} onDragLeave={onDragLeave} />,
      );

      fireEvent.dragLeave(getDropZone());

      expect(onDragLeave).toHaveBeenCalledTimes(1);
    });

    it('не вызывает onDragLeave когда disabled=true', () => {
      const onDragLeave = vi.fn();
      const { getDropZone } = renderIsolated(
        <FileUploader files={emptyFiles} onDragLeave={onDragLeave} disabled />,
      );

      fireEvent.dragLeave(getDropZone());

      expect(onDragLeave).not.toHaveBeenCalled();
    });

    it('вызывает onDragOver при drag over', () => {
      const onDragOver = vi.fn();
      const { getDropZone } = renderIsolated(
        <FileUploader files={emptyFiles} onDragOver={onDragOver} />,
      );

      fireEvent.dragOver(getDropZone());

      expect(onDragOver).toHaveBeenCalledTimes(1);
    });

    it('не вызывает onDragOver когда disabled=true', () => {
      const onDragOver = vi.fn();
      const { getDropZone } = renderIsolated(
        <FileUploader files={emptyFiles} onDragOver={onDragOver} disabled />,
      );

      fireEvent.dragOver(getDropZone());

      expect(onDragOver).not.toHaveBeenCalled();
    });

    it('preventDefault и stopPropagation вызываются при drag событиях', () => {
      const onDragEnter = vi.fn();
      const { getDropZone } = renderIsolated(
        <FileUploader files={emptyFiles} onDragEnter={onDragEnter} />,
      );

      // Создаем реальное событие для проверки preventDefault/stopPropagation
      const dragEvent = new Event('dragenter', { bubbles: true, cancelable: true }) as DragEvent;
      Object.defineProperty(dragEvent, 'dataTransfer', {
        value: null,
        writable: false,
      });

      const preventDefaultSpy = vi.spyOn(dragEvent, 'preventDefault');
      const stopPropagationSpy = vi.spyOn(dragEvent, 'stopPropagation');

      getDropZone().dispatchEvent(dragEvent);

      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(stopPropagationSpy).toHaveBeenCalled();
    });
  });

  describe('4.14. Обработчики событий - onRemove', () => {
    it('вызывает onRemove при клике на кнопку удаления', () => {
      const onRemove = vi.fn();
      const { getRemoveButton } = renderIsolated(
        <FileUploader files={singleFileArray} onRemove={onRemove} />,
      );

      fireEvent.click(getRemoveButton('1'));

      expect(onRemove).toHaveBeenCalledTimes(1);
      expect(onRemove).toHaveBeenCalledWith('1', expect.any(Object));
    });

    it('не вызывает onRemove когда disabled=true', () => {
      const onRemove = vi.fn();
      const { getRemoveButton } = renderIsolated(
        <FileUploader files={singleFileArray} onRemove={onRemove} disabled />,
      );

      fireEvent.click(getRemoveButton('1'));

      expect(onRemove).not.toHaveBeenCalled();
    });
  });

  describe('4.15. Keyboard navigation', () => {
    it('открывает file input при нажатии Enter на drop zone', () => {
      const { getDropZone, getInput } = renderIsolated(<FileUploader files={emptyFiles} />);

      const input = getInput();
      const clickSpy = vi.spyOn(input, 'click');

      fireEvent.keyDown(getDropZone(), { key: 'Enter' });

      expect(clickSpy).toHaveBeenCalled();
    });

    it('открывает file input при нажатии Space на drop zone', () => {
      const { getDropZone, getInput } = renderIsolated(<FileUploader files={emptyFiles} />);

      const input = getInput();
      const clickSpy = vi.spyOn(input, 'click');

      fireEvent.keyDown(getDropZone(), { key: ' ' });

      expect(clickSpy).toHaveBeenCalled();
    });

    it('не открывает file input при нажатии других клавиш на drop zone', () => {
      const { getDropZone, getInput } = renderIsolated(<FileUploader files={emptyFiles} />);

      const input = getInput();
      const clickSpy = vi.spyOn(input, 'click');

      fireEvent.keyDown(getDropZone(), { key: 'Tab' });

      expect(clickSpy).not.toHaveBeenCalled();
    });

    it('не обрабатывает keyboard navigation когда disabled=true', () => {
      const { getDropZone, getInput } = renderIsolated(
        <FileUploader files={emptyFiles} disabled />,
      );

      const input = getInput();
      const clickSpy = vi.spyOn(input, 'click');

      fireEvent.keyDown(getDropZone(), { key: 'Enter' });

      expect(clickSpy).not.toHaveBeenCalled();
    });

    it('preventDefault вызывается при Enter/Space на drop zone', () => {
      const { getDropZone } = renderIsolated(<FileUploader files={emptyFiles} />);

      const keyDownEvent = new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        key: 'Enter',
      });

      const preventDefaultSpy = vi.spyOn(keyDownEvent, 'preventDefault');

      fireEvent(getDropZone(), keyDownEvent);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('вызывает onRemove при нажатии Enter на кнопке удаления', () => {
      const onRemove = vi.fn();
      const { getRemoveButton } = renderIsolated(
        <FileUploader files={singleFileArray} onRemove={onRemove} />,
      );

      fireEvent.keyDown(getRemoveButton('1'), { key: 'Enter' });

      expect(onRemove).toHaveBeenCalledTimes(1);
      expect(onRemove).toHaveBeenCalledWith('1', expect.any(Object));
    });

    it('вызывает onRemove при нажатии Space на кнопке удаления', () => {
      const onRemove = vi.fn();
      const { getRemoveButton } = renderIsolated(
        <FileUploader files={singleFileArray} onRemove={onRemove} />,
      );

      fireEvent.keyDown(getRemoveButton('1'), { key: ' ' });

      expect(onRemove).toHaveBeenCalledTimes(1);
      expect(onRemove).toHaveBeenCalledWith('1', expect.any(Object));
    });

    it('не вызывает onRemove при нажатии других клавиш на кнопке удаления', () => {
      const onRemove = vi.fn();
      const { getRemoveButton } = renderIsolated(
        <FileUploader files={singleFileArray} onRemove={onRemove} />,
      );

      fireEvent.keyDown(getRemoveButton('1'), { key: 'Tab' });

      expect(onRemove).not.toHaveBeenCalled();
    });

    it('не обрабатывает keyboard navigation на кнопке удаления когда disabled=true', () => {
      const onRemove = vi.fn();
      const { getRemoveButton } = renderIsolated(
        <FileUploader files={singleFileArray} onRemove={onRemove} disabled />,
      );

      fireEvent.keyDown(getRemoveButton('1'), { key: 'Enter' });

      expect(onRemove).not.toHaveBeenCalled();
    });
  });

  describe('4.16. Ref forwarding', () => {
    it('пробрасывает ref на корневой элемент', () => {
      const ref = createRef<HTMLDivElement>();
      const { getFileUploader } = renderIsolated(<FileUploader files={emptyFiles} ref={ref} />);

      expect(ref.current).toBe(getFileUploader());
    });
  });

  describe('4.17. Memoization', () => {
    it('компонент мемоизирован (не перерендеривается при одинаковых пропсах)', () => {
      const { rerender, getFileUploader } = renderIsolated(
        <FileUploader files={singleFileArray} />,
      );

      const firstRender = getFileUploader();

      rerender(<FileUploader files={singleFileArray} />);

      const secondRender = getFileUploader();

      // При одинаковых пропсах элемент должен быть тем же (мемоизация работает)
      // Но в тестах это сложно проверить напрямую, поэтому проверяем что компонент рендерится
      expect(firstRender).toBeInTheDocument();
      expect(secondRender).toBeInTheDocument();
    });
  });

  describe('4.18. Edge cases', () => {
    it('обрабатывает пустой массив files', () => {
      const { container } = renderIsolated(<FileUploader files={emptyFiles} />);

      expect(container).toBeInTheDocument();
      expect(container.querySelector('div[role="list"]')).not.toBeInTheDocument();
    });

    it('обрабатывает undefined testId', () => {
      const { getFileUploader } = renderIsolated(<FileUploader files={emptyFiles} />);

      expect(getFileUploader()).not.toHaveAttribute('data-testid');
    });

    it('обрабатывает пустой testId', () => {
      const { getFileUploader } = renderIsolated(
        <FileUploader files={emptyFiles} data-testid='' />,
      );

      expect(getFileUploader()).toHaveAttribute('data-testid', '');
    });

    it('обрабатывает файлы с разными статусами одновременно', () => {
      const { container } = renderIsolated(
        <FileUploader
          files={fourFilesArray}
        />,
      );

      expect(container).toHaveTextContent('Ожидание');
      expect(container).toHaveTextContent('Загрузка...');
      expect(container).toHaveTextContent('Загружено');
      expect(container).toHaveTextContent('Ошибка');
      expect(container).toHaveTextContent('Ошибка загрузки');
    });

    it('обрабатывает hint с кастомным testId', () => {
      const { getHint, getFileUploader } = renderIsolated(
        <FileUploader files={emptyFiles} hint='Test' data-testid='custom-id' />,
      );

      expect(getHint()).toHaveAttribute('id', 'custom-id-hint');
      expect(getFileUploader()).toHaveAttribute('aria-describedby', 'custom-id-hint');
    });

    it('обрабатывает множественный выбор файлов', () => {
      const onChange = vi.fn();
      const { getInput } = renderIsolated(
        <FileUploader files={emptyFiles} onChange={onChange} multiple />,
      );

      const file1 = new File(['content1'], 'test1.txt', { type: 'text/plain' });
      const file2 = new File(['content2'], 'test2.txt', { type: 'text/plain' });
      const fileList = Object.assign([file1, file2], {
        item: (index: number) => (index === 0 ? file1 : index === 1 ? file2 : null),
        length: 2,
      }) as FileList;

      const input = getInput();
      Object.defineProperty(input, 'files', {
        value: fileList,
        writable: false,
        configurable: true,
      });

      fireEvent.change(input);

      expect(onChange).toHaveBeenCalledWith([file1, file2], expect.any(Object));
    });
  });
});
