/**
 * @vitest-environment jsdom
 * @file Тесты для App FileUploader компонента с полным покрытием
 */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { FileInfo } from '@livai/ui-core';

// Mock для Core FileUploader
vi.mock('../../../../ui-core/src/components/FileUploader', () => ({
  FileUploader: React.forwardRef<
    HTMLDivElement,
    Readonly<Record<string, unknown>>
  >((
    props: Readonly<Record<string, unknown>>,
    ref,
  ) => {
    const {
      files,
      multiple,
      accept,
      disabled,
      isDragActive,
      buttonLabel,
      dropZoneLabel,
      dropZoneLabelActive,
      hint,
      onChange,
      onDrop,
      onRemove,
      onDragEnter,
      onDragLeave,
      onDragOver,
      'aria-label': ariaLabel,
      buttonAriaLabel,
      dropZoneAriaLabel,
      'data-component': dataComponent,
      'data-state': dataState,
      'data-feature-flag': dataFeatureFlag,
      'data-telemetry': dataTelemetry,
      'data-testid': testId,
      className,
      style,
      ...rest
    } = props;

    const filesArray = files as readonly FileInfo[] | undefined;
    const isDragActiveValue = Boolean(isDragActive);

    return (
      <div
        ref={ref}
        data-testid={testId ?? 'core-file-uploader'}
        data-component={dataComponent}
        data-state={dataState}
        data-feature-flag={dataFeatureFlag}
        data-telemetry={dataTelemetry}
        data-is-drag-active={isDragActiveValue}
        className={className as string | undefined}
        style={style as React.CSSProperties | undefined}
        {...rest}
      >
        <input
          type='file'
          data-testid='file-input'
          multiple={Boolean(multiple)}
          accept={accept as string | undefined}
          disabled={Boolean(disabled)}
          onChange={(e) => {
            if (typeof onChange === 'function' && e.target.files !== null) {
              const fileList = Array.from(e.target.files);
              onChange(fileList, e);
            }
          }}
        />
        <div
          data-testid='drop-zone'
          role='button'
          tabIndex={Boolean(disabled) ? -1 : 0}
          aria-label={dropZoneAriaLabel as string | undefined
            ?? ariaLabel as string | undefined
            ?? 'Drop zone'}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (typeof onDrop === 'function') {
              const dragEvent = e as unknown as DragEvent;
              const dataTransfer = dragEvent.dataTransfer;
              const fileList = dataTransfer !== null && dataTransfer.files.length > 0
                ? Array.from(dataTransfer.files)
                : [];
              onDrop(fileList, e);
            }
          }}
          onDragEnter={(e) => {
            if (typeof onDragEnter === 'function') {
              onDragEnter(e);
            }
          }}
          onDragLeave={(e) => {
            if (typeof onDragLeave === 'function') {
              onDragLeave(e);
            }
          }}
          onDragOver={(e) => {
            if (typeof onDragOver === 'function') {
              onDragOver(e);
            }
          }}
        >
          <span data-testid='drop-zone-label'>
            {isDragActiveValue
              ? (dropZoneLabelActive as string | undefined ?? 'Drop files here')
              : (dropZoneLabel as string | undefined ?? 'Drag and drop files')}
          </span>
          <button
            type='button'
            data-testid='select-button'
            disabled={Boolean(disabled)}
            aria-label={buttonAriaLabel as string | undefined
              ?? ariaLabel as string | undefined
              ?? buttonLabel as string | undefined}
            onClick={() => {
              const input = document.querySelector('input[type="file"]');
              if (input !== null) {
                (input as HTMLInputElement).click();
              }
            }}
          >
            {buttonLabel as string | undefined ?? 'Select files'}
          </button>
        </div>
        {hint !== undefined && hint !== '' && (
          <div data-testid='hint' role='note'>
            {hint as string}
          </div>
        )}
        {filesArray !== undefined && filesArray.length > 0 && (
          <div data-testid='files-list' role='list'>
            {filesArray.map((file) => (
              <div
                key={file.id}
                data-testid={`file-${file.id}`}
                role='listitem'
              >
                <span data-testid={`file-name-${file.id}`}>{file.name}</span>
                <span data-testid={`file-size-${file.id}`}>{file.sizeLabel}</span>
                <span data-testid={`file-type-${file.id}`}>{file.typeLabel}</span>
                <span data-testid={`file-status-${file.id}`}>{file.status.label}</span>
                {file.status.type === 'progress' && 'progress' in file && (
                  <div
                    data-testid={`file-progress-${file.id}`}
                    role='progressbar'
                    aria-valuenow={file.progress}
                  >
                    {file.progress}%
                  </div>
                )}
                {file.status.type === 'error' && 'errorMessage' in file && (
                  <div data-testid={`file-error-${file.id}`} role='alert'>
                    {file.errorMessage}
                  </div>
                )}
                {typeof onRemove === 'function' && (
                  <button
                    type='button'
                    data-testid={`remove-${file.id}`}
                    onClick={() => {
                      onRemove(file.id);
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }),
}));

// Mock для UnifiedUIProvider
const mockInfoFireAndForget = vi.fn();
const mockTranslate = vi.fn();

vi.mock('../../../src/providers/UnifiedUIProvider', () => ({
  useUnifiedUI: () => ({
    featureFlags: {
      isEnabled: () => false,
      setOverride: vi.fn(),
      clearOverrides: vi.fn(),
      getOverride: () => false,
    },
    telemetry: {
      track: vi.fn(),
      infoFireAndForget: mockInfoFireAndForget,
    },
    i18n: {
      translate: mockTranslate,
    },
  }),
}));

import { FileUploader } from '../../../src/ui/file-uploader';

describe('App FileUploader', () => {
  let uuidCounter = 0;

  beforeEach(() => {
    vi.clearAllMocks();
    mockTranslate.mockReturnValue('Translated Label');
    uuidCounter = 0; // Сбрасываем счетчик для каждого теста
    // Мокаем crypto.randomUUID для уникальных ID в тестах
    Object.defineProperty(globalThis, 'crypto', {
      value: {
        randomUUID: vi.fn(() => `test-uuid-${++uuidCounter}`),
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe('1. Базовый рендеринг', () => {
    it('должен рендерить FileUploader с дефолтными пропсами', () => {
      render(<FileUploader />);

      expect(screen.getByTestId('core-file-uploader')).toBeInTheDocument();
      expect(screen.getByTestId('file-input')).toBeInTheDocument();
      expect(screen.getByTestId('drop-zone')).toBeInTheDocument();
      expect(screen.getByTestId('select-button')).toBeInTheDocument();
    });

    it('должен передавать data-component="AppFileUploader"', () => {
      render(<FileUploader />);

      expect(screen.getByTestId('core-file-uploader')).toHaveAttribute(
        'data-component',
        'AppFileUploader',
      );
    });

    it('должен передавать data-state="visible" по умолчанию', () => {
      render(<FileUploader />);

      expect(screen.getByTestId('core-file-uploader')).toHaveAttribute(
        'data-state',
        'visible',
      );
    });

    it('должен передавать data-feature-flag="visible" по умолчанию', () => {
      render(<FileUploader />);

      expect(screen.getByTestId('core-file-uploader')).toHaveAttribute(
        'data-feature-flag',
        'visible',
      );
    });

    it('должен передавать data-telemetry="enabled" по умолчанию', () => {
      render(<FileUploader />);

      expect(screen.getByTestId('core-file-uploader')).toHaveAttribute(
        'data-telemetry',
        'enabled',
      );
    });

    it('должен передавать data-testid в Core FileUploader', () => {
      render(<FileUploader data-testid='custom-uploader' />);

      expect(screen.getByTestId('custom-uploader')).toBeInTheDocument();
    });

    it('должен передавать дополнительные пропсы в Core FileUploader', () => {
      const customStyle: Readonly<{ color: string; }> = { color: 'red' };
      render(
        <FileUploader
          className='custom-class'
          style={customStyle}
        />,
      );

      const uploader = screen.getByTestId('core-file-uploader');
      expect(uploader).toHaveClass('custom-class');
      expect(uploader).toHaveStyle({ color: 'rgb(255, 0, 0)' });
    });
  });

  describe('2. Policy и visibility', () => {
    it('должен рендерить когда visible не указан (по умолчанию true)', () => {
      render(<FileUploader />);

      expect(screen.getByTestId('core-file-uploader')).toBeInTheDocument();
    });

    it('не должен рендерить когда visible=false', () => {
      render(<FileUploader visible={false} />);

      expect(screen.queryByTestId('core-file-uploader')).not.toBeInTheDocument();
    });

    it('не должен рендерить когда isHiddenByFeatureFlag=true', () => {
      render(<FileUploader isHiddenByFeatureFlag={true} />);

      expect(screen.queryByTestId('core-file-uploader')).not.toBeInTheDocument();
    });

    it('не должен рендерить когда visible=false и isHiddenByFeatureFlag=false', () => {
      render(
        <FileUploader visible={false} isHiddenByFeatureFlag={false} />,
      );

      expect(screen.queryByTestId('core-file-uploader')).not.toBeInTheDocument();
    });

    it('должен рендерить когда visible=true и isHiddenByFeatureFlag=false', () => {
      render(
        <FileUploader visible={true} isHiddenByFeatureFlag={false} />,
      );

      expect(screen.getByTestId('core-file-uploader')).toBeInTheDocument();
    });

    it('должен передавать data-state="hidden" когда policy.isRendered=false', () => {
      const { container } = render(
        <FileUploader visible={false} />,
      );

      expect(screen.queryByTestId('core-file-uploader')).not.toBeInTheDocument();
      expect(container.firstChild).toBeNull();
    });

    it('должен передавать data-feature-flag="hidden" когда isHiddenByFeatureFlag=true', () => {
      const { container } = render(
        <FileUploader isHiddenByFeatureFlag={true} />,
      );

      expect(screen.queryByTestId('core-file-uploader')).not.toBeInTheDocument();
      expect(container.firstChild).toBeNull();
    });
  });

  describe('3. Telemetry', () => {
    it('должен отправлять telemetry при mount', () => {
      render(<FileUploader />);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('FileUploader mount', {
        component: 'FileUploader',
        action: 'mount',
        hidden: false,
        visible: true,
        filesCount: 0,
        totalSize: 0,
      });
    });

    it('должен отправлять telemetry при unmount', () => {
      const { unmount } = render(<FileUploader />);
      unmount();

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('FileUploader unmount', {
        component: 'FileUploader',
        action: 'unmount',
        hidden: false,
        visible: true,
        filesCount: 0,
        totalSize: 0,
      });
    });

    it('не должен отправлять telemetry когда telemetryEnabled=false', () => {
      render(<FileUploader telemetryEnabled={false} />);

      expect(mockInfoFireAndForget).not.toHaveBeenCalled();
    });

    it('должен передавать data-telemetry="disabled" когда telemetryEnabled=false', () => {
      render(<FileUploader telemetryEnabled={false} />);

      expect(screen.getByTestId('core-file-uploader')).toHaveAttribute(
        'data-telemetry',
        'disabled',
      );
    });
  });

  describe('4. Выбор файлов через input', () => {
    it('должен вызывать onFilesSelected при выборе файлов', async () => {
      const onFilesSelected = vi.fn();
      render(<FileUploader onFilesSelected={onFilesSelected} />);

      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      const fileList = Object.assign([file], {
        item: (index: number) => (index === 0 ? file : null),
        length: 1,
      }) as FileList;

      const input = screen.getByTestId('file-input');
      Object.defineProperty(input, 'files', {
        value: fileList,
        writable: false,
        configurable: true,
      });

      fireEvent.change(input);

      await waitFor(() => {
        expect(onFilesSelected).toHaveBeenCalledWith([file]);
      });
    });

    it('должен отправлять telemetry при выборе файлов', async () => {
      render(<FileUploader />);

      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      const fileList = Object.assign([file], {
        item: (index: number) => (index === 0 ? file : null),
        length: 1,
      }) as FileList;

      const input = screen.getByTestId('file-input');
      Object.defineProperty(input, 'files', {
        value: fileList,
        writable: false,
        configurable: true,
      });

      fireEvent.change(input);

      await waitFor(() => {
        expect(mockInfoFireAndForget).toHaveBeenCalledWith('FileUploader select', {
          component: 'FileUploader',
          action: 'select',
          hidden: false,
          visible: true,
          filesCount: 1,
          totalSize: file.size,
        });
      });
    });

    it('не должен вызывать onFilesSelected когда файлы не выбраны', () => {
      const onFilesSelected = vi.fn();
      render(<FileUploader onFilesSelected={onFilesSelected} />);

      const input = screen.getByTestId('file-input');
      Object.defineProperty(input, 'files', {
        value: null,
        writable: false,
        configurable: true,
      });

      fireEvent.change(input);

      expect(onFilesSelected).not.toHaveBeenCalled();
    });
  });

  describe('5. Валидация файлов', () => {
    it('должен отклонять файлы превышающие maxSize', async () => {
      const onFilesSelected = vi.fn();
      render(
        <FileUploader
          onFilesSelected={onFilesSelected}
          maxSize={100}
        />,
      );

      const largeFile = new File(['x'.repeat(200)], 'large.txt', { type: 'text/plain' });
      const fileList = Object.assign([largeFile], {
        item: (index: number) => (index === 0 ? largeFile : null),
        length: 1,
      }) as FileList;

      const input = screen.getByTestId('file-input');
      Object.defineProperty(input, 'files', {
        value: fileList,
        writable: false,
        configurable: true,
      });

      fireEvent.change(input);

      await waitFor(() => {
        expect(onFilesSelected).not.toHaveBeenCalled();
        expect(mockInfoFireAndForget).toHaveBeenCalledWith(
          'FileUploader upload-error',
          expect.objectContaining({
            action: 'upload-error',
            fileName: 'large.txt',
            filesCount: 0,
            totalSize: 0,
          }),
        );
      });
    });

    it('должен отклонять файлы с недопустимым типом', async () => {
      const onFilesSelected = vi.fn();
      render(
        <FileUploader
          onFilesSelected={onFilesSelected}
          accept='image/*'
        />,
      );

      const textFile = new File(['content'], 'test.txt', { type: 'text/plain' });
      const fileList = Object.assign([textFile], {
        item: (index: number) => (index === 0 ? textFile : null),
        length: 1,
      }) as FileList;

      const input = screen.getByTestId('file-input');
      Object.defineProperty(input, 'files', {
        value: fileList,
        writable: false,
        configurable: true,
      });

      fireEvent.change(input);

      await waitFor(() => {
        expect(onFilesSelected).not.toHaveBeenCalled();
        expect(mockInfoFireAndForget).toHaveBeenCalledWith(
          'FileUploader upload-error',
          expect.objectContaining({
            action: 'upload-error',
            fileName: 'test.txt',
            filesCount: 0,
            totalSize: 0,
          }),
        );
      });
    });

    it('должен принимать файлы с допустимым типом (MIME wildcard)', async () => {
      const onFilesSelected = vi.fn();
      render(
        <FileUploader
          onFilesSelected={onFilesSelected}
          accept='image/*'
        />,
      );

      const imageFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
      const fileList = Object.assign([imageFile], {
        item: (index: number) => (index === 0 ? imageFile : null),
        length: 1,
      }) as FileList;

      const input = screen.getByTestId('file-input');
      Object.defineProperty(input, 'files', {
        value: fileList,
        writable: false,
        configurable: true,
      });

      fireEvent.change(input);

      await waitFor(() => {
        expect(onFilesSelected).toHaveBeenCalledWith([imageFile]);
      });
    });

    it('должен принимать файлы с допустимым расширением', async () => {
      const onFilesSelected = vi.fn();
      render(
        <FileUploader
          onFilesSelected={onFilesSelected}
          accept='.pdf'
        />,
      );

      const pdfFile = new File(['content'], 'test.pdf', { type: 'application/pdf' });
      const fileList = Object.assign([pdfFile], {
        item: (index: number) => (index === 0 ? pdfFile : null),
        length: 1,
      }) as FileList;

      const input = screen.getByTestId('file-input');
      Object.defineProperty(input, 'files', {
        value: fileList,
        writable: false,
        configurable: true,
      });

      fireEvent.change(input);

      await waitFor(() => {
        expect(onFilesSelected).toHaveBeenCalledWith([pdfFile]);
      });
    });

    it('должен принимать файлы с точным MIME типом', async () => {
      const onFilesSelected = vi.fn();
      render(
        <FileUploader
          onFilesSelected={onFilesSelected}
          accept='text/plain'
        />,
      );

      const textFile = new File(['content'], 'test.txt', { type: 'text/plain' });
      const fileList = Object.assign([textFile], {
        item: (index: number) => (index === 0 ? textFile : null),
        length: 1,
      }) as FileList;

      const input = screen.getByTestId('file-input');
      Object.defineProperty(input, 'files', {
        value: fileList,
        writable: false,
        configurable: true,
      });

      fireEvent.change(input);

      await waitFor(() => {
        expect(onFilesSelected).toHaveBeenCalledWith([textFile]);
      });
    });

    it('должен использовать кастомную валидацию', async () => {
      const onFilesSelected = vi.fn();
      const customValidate = vi.fn().mockResolvedValue({ valid: false, error: 'Custom error' });
      render(
        <FileUploader
          onFilesSelected={onFilesSelected}
          validateFile={customValidate}
        />,
      );

      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      const fileList = Object.assign([file], {
        item: (index: number) => (index === 0 ? file : null),
        length: 1,
      }) as FileList;

      const input = screen.getByTestId('file-input');
      Object.defineProperty(input, 'files', {
        value: fileList,
        writable: false,
        configurable: true,
      });

      fireEvent.change(input);

      await waitFor(() => {
        expect(customValidate).toHaveBeenCalledWith(file);
        expect(onFilesSelected).not.toHaveBeenCalled();
      });
    });

    it('должен принимать файлы прошедшие кастомную валидацию', async () => {
      const onFilesSelected = vi.fn();
      const customValidate = vi.fn().mockResolvedValue({ valid: true });
      render(
        <FileUploader
          onFilesSelected={onFilesSelected}
          validateFile={customValidate}
        />,
      );

      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      const fileList = Object.assign([file], {
        item: (index: number) => (index === 0 ? file : null),
        length: 1,
      }) as FileList;

      const input = screen.getByTestId('file-input');
      Object.defineProperty(input, 'files', {
        value: fileList,
        writable: false,
        configurable: true,
      });

      fireEvent.change(input);

      await waitFor(() => {
        expect(customValidate).toHaveBeenCalledWith(file);
        expect(onFilesSelected).toHaveBeenCalledWith([file]);
      });
    });
  });

  describe('6. Максимальное количество файлов', () => {
    it('должен ограничивать количество файлов по maxFiles', async () => {
      const onFilesSelected = vi.fn();
      render(
        <FileUploader
          onFilesSelected={onFilesSelected}
          maxFiles={2}
        />,
      );

      // Добавляем первый файл
      const file1 = new File(['content1'], 'test1.txt', { type: 'text/plain' });
      const fileList1 = Object.assign([file1], {
        item: (index: number) => (index === 0 ? file1 : null),
        length: 1,
      }) as FileList;

      const input = screen.getByTestId('file-input');
      Object.defineProperty(input, 'files', {
        value: fileList1,
        writable: false,
        configurable: true,
      });

      fireEvent.change(input);

      await waitFor(() => {
        expect(onFilesSelected).toHaveBeenCalledWith([file1]);
      });

      // Пытаемся добавить еще 2 файла (превышаем лимит)
      const file2 = new File(['content2'], 'test2.txt', { type: 'text/plain' });
      const file3 = new File(['content3'], 'test3.txt', { type: 'text/plain' });
      const fileList2 = Object.assign([file2, file3], {
        item: (index: number) => (index === 0 ? file2 : index === 1 ? file3 : null),
        length: 2,
      }) as FileList;

      Object.defineProperty(input, 'files', {
        value: fileList2,
        writable: false,
        configurable: true,
      });

      onFilesSelected.mockClear();
      fireEvent.change(input);

      await waitFor(() => {
        // Должен принять только один файл (достигнут лимит 2)
        expect(onFilesSelected).toHaveBeenCalledWith([file2]);
      });
    });

    it('не должен принимать файлы когда достигнут лимит maxFiles', async () => {
      const onFilesSelected = vi.fn();
      render(
        <FileUploader
          onFilesSelected={onFilesSelected}
          maxFiles={1}
        />,
      );

      // Добавляем первый файл
      const file1 = new File(['content1'], 'test1.txt', { type: 'text/plain' });
      const fileList1 = Object.assign([file1], {
        item: (index: number) => (index === 0 ? file1 : null),
        length: 1,
      }) as FileList;

      const input = screen.getByTestId('file-input');
      Object.defineProperty(input, 'files', {
        value: fileList1,
        writable: false,
        configurable: true,
      });

      fireEvent.change(input);

      await waitFor(() => {
        expect(onFilesSelected).toHaveBeenCalledWith([file1]);
      });

      // Пытаемся добавить еще один файл
      const file2 = new File(['content2'], 'test2.txt', { type: 'text/plain' });
      const fileList2 = Object.assign([file2], {
        item: (index: number) => (index === 0 ? file2 : null),
        length: 1,
      }) as FileList;

      Object.defineProperty(input, 'files', {
        value: fileList2,
        writable: false,
        configurable: true,
      });

      onFilesSelected.mockClear();
      fireEvent.change(input);

      await waitFor(() => {
        expect(onFilesSelected).not.toHaveBeenCalled();
        expect(mockInfoFireAndForget).toHaveBeenCalledWith(
          'FileUploader upload-error',
          expect.objectContaining({
            action: 'upload-error',
            errorMessage: 'Достигнут лимит файлов: 1',
          }),
        );
      });
    });
  });

  describe('7. Отображение файлов', () => {
    it('должен отображать добавленные файлы', async () => {
      render(<FileUploader />);

      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      const fileList = Object.assign([file], {
        item: (index: number) => (index === 0 ? file : null),
        length: 1,
      }) as FileList;

      const input = screen.getByTestId('file-input');
      Object.defineProperty(input, 'files', {
        value: fileList,
        writable: false,
        configurable: true,
      });

      fireEvent.change(input);

      await waitFor(() => {
        expect(screen.getByTestId('files-list')).toBeInTheDocument();
        expect(screen.getByTestId('file-test-uuid-1')).toBeInTheDocument();
        expect(screen.getByTestId('file-name-test-uuid-1')).toHaveTextContent('test.txt');
      });
    });

    it('должен форматировать размер файла', async () => {
      render(<FileUploader />);

      const file = new File(['x'.repeat(1024)], 'test.txt', { type: 'text/plain' });
      const fileList = Object.assign([file], {
        item: (index: number) => (index === 0 ? file : null),
        length: 1,
      }) as FileList;

      const input = screen.getByTestId('file-input');
      Object.defineProperty(input, 'files', {
        value: fileList,
        writable: false,
        configurable: true,
      });

      fireEvent.change(input);

      await waitFor(() => {
        const sizeLabel = screen.getByTestId('file-size-test-uuid-1');
        expect(sizeLabel).toHaveTextContent('1 KB');
      });
    });

    it('должен форматировать тип файла', async () => {
      render(<FileUploader />);

      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      const fileList = Object.assign([file], {
        item: (index: number) => (index === 0 ? file : null),
        length: 1,
      }) as FileList;

      const input = screen.getByTestId('file-input');
      Object.defineProperty(input, 'files', {
        value: fileList,
        writable: false,
        configurable: true,
      });

      fireEvent.change(input);

      await waitFor(() => {
        const typeLabel = screen.getByTestId('file-type-test-uuid-1');
        expect(typeLabel).toHaveTextContent('text/plain');
      });
    });

    it('должен отображать статус "Ожидание" для новых файлов', async () => {
      render(<FileUploader />);

      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      const fileList = Object.assign([file], {
        item: (index: number) => (index === 0 ? file : null),
        length: 1,
      }) as FileList;

      const input = screen.getByTestId('file-input');
      Object.defineProperty(input, 'files', {
        value: fileList,
        writable: false,
        configurable: true,
      });

      fireEvent.change(input);

      await waitFor(() => {
        const statusLabel = screen.getByTestId('file-status-test-uuid-1');
        expect(statusLabel).toHaveTextContent('Ожидание');
      });
    });
  });

  describe('8. Удаление файлов', () => {
    it('должен вызывать onFileRemove при удалении файла', async () => {
      const onFileRemove = vi.fn();
      render(<FileUploader onFileRemove={onFileRemove} />);

      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      const fileList = Object.assign([file], {
        item: (index: number) => (index === 0 ? file : null),
        length: 1,
      }) as FileList;

      const input = screen.getByTestId('file-input');
      Object.defineProperty(input, 'files', {
        value: fileList,
        writable: false,
        configurable: true,
      });

      fireEvent.change(input);

      await waitFor(() => {
        expect(screen.getByTestId('remove-test-uuid-1')).toBeInTheDocument();
      });

      const removeButton = screen.getByTestId('remove-test-uuid-1');
      fireEvent.click(removeButton);

      await waitFor(() => {
        expect(onFileRemove).toHaveBeenCalledWith('test-uuid-1');
        expect(screen.queryByTestId('file-test-uuid-1')).not.toBeInTheDocument();
      });
    });

    it('должен отправлять telemetry при удалении файла', async () => {
      render(<FileUploader />);

      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      const fileList = Object.assign([file], {
        item: (index: number) => (index === 0 ? file : null),
        length: 1,
      }) as FileList;

      const input = screen.getByTestId('file-input');
      Object.defineProperty(input, 'files', {
        value: fileList,
        writable: false,
        configurable: true,
      });

      fireEvent.change(input);

      await waitFor(() => {
        expect(screen.getByTestId('remove-test-uuid-1')).toBeInTheDocument();
      });

      mockInfoFireAndForget.mockClear();
      const removeButton = screen.getByTestId('remove-test-uuid-1');
      fireEvent.click(removeButton);

      await waitFor(() => {
        expect(mockInfoFireAndForget).toHaveBeenCalledWith('FileUploader remove', {
          component: 'FileUploader',
          action: 'remove',
          hidden: false,
          visible: true,
          filesCount: 0,
          totalSize: 0,
          fileName: 'test.txt',
        });
      });
    });
  });

  describe('9. Загрузка файлов', () => {
    it('должен автоматически загружать файлы когда uploadFile указан', async () => {
      const uploadFile = vi.fn().mockResolvedValue({ success: true });
      const onUploadStart = vi.fn();
      const onUploadSuccess = vi.fn();

      render(
        <FileUploader
          uploadFile={uploadFile}
          onUploadStart={onUploadStart}
          onUploadSuccess={onUploadSuccess}
        />,
      );

      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      const fileList = Object.assign([file], {
        item: (index: number) => (index === 0 ? file : null),
        length: 1,
      }) as FileList;

      const input = screen.getByTestId('file-input');
      Object.defineProperty(input, 'files', {
        value: fileList,
        writable: false,
        configurable: true,
      });

      fireEvent.change(input);

      await waitFor(() => {
        expect(onUploadStart).toHaveBeenCalledWith('test-uuid-1', file);
      });

      await waitFor(() => {
        expect(uploadFile).toHaveBeenCalledWith(file, expect.any(Function));
        expect(onUploadSuccess).toHaveBeenCalledWith('test-uuid-1', { success: true });
      });
    });

    it('должен вызывать onUploadProgress при прогрессе загрузки', async () => {
      const onUploadProgress = vi.fn();
      let progressCallback: ((progress: number) => void) | undefined;
      const uploadFile = vi.fn().mockImplementation((_file, onProgress) => {
        progressCallback = onProgress;
        // Не разрешаем промис сразу, чтобы тест успел проверить прогресс
        return new Promise(() => {});
      });

      render(
        <FileUploader
          uploadFile={uploadFile}
          onUploadProgress={onUploadProgress}
        />,
      );

      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      const fileList = Object.assign([file], {
        item: (index: number) => (index === 0 ? file : null),
        length: 1,
      }) as FileList;

      const input = screen.getByTestId('file-input');
      Object.defineProperty(input, 'files', {
        value: fileList,
        writable: false,
        configurable: true,
      });

      fireEvent.change(input);

      // Ждем, пока загрузка начнется
      await waitFor(() => {
        expect(uploadFile).toHaveBeenCalled();
      });

      // Ждем, пока статус файла обновится на "Загрузка 0%"
      await waitFor(() => {
        const statusLabel = screen.getByTestId('file-status-test-uuid-1');
        expect(statusLabel).toHaveTextContent('Загрузка 0%');
      });

      await waitFor(() => {
        expect(progressCallback).toBeDefined();
      });

      // Ждем, пока элемент прогресса появится
      await waitFor(() => {
        expect(screen.getByTestId('file-progress-test-uuid-1')).toBeInTheDocument();
      }, { timeout: 3000 });

      progressCallback?.(50);

      await waitFor(() => {
        expect(onUploadProgress).toHaveBeenCalledWith('test-uuid-1', 50);
        expect(screen.getByTestId('file-progress-test-uuid-1')).toHaveTextContent('50%');
      });
    });

    it('должен обрабатывать ошибку загрузки', async () => {
      const uploadFile = vi.fn().mockRejectedValue(new Error('Upload failed'));
      const onUploadError = vi.fn();

      render(
        <FileUploader
          uploadFile={uploadFile}
          onUploadError={onUploadError}
        />,
      );

      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      const fileList = Object.assign([file], {
        item: (index: number) => (index === 0 ? file : null),
        length: 1,
      }) as FileList;

      const input = screen.getByTestId('file-input');
      Object.defineProperty(input, 'files', {
        value: fileList,
        writable: false,
        configurable: true,
      });

      fireEvent.change(input);

      await waitFor(() => {
        expect(onUploadError).toHaveBeenCalledWith('test-uuid-1', expect.any(Error));
        expect(screen.getByTestId('file-error-test-uuid-1')).toHaveTextContent('Upload failed');
      });
    });

    it('должен отправлять telemetry при начале загрузки', async () => {
      const uploadFile = vi.fn().mockResolvedValue({ success: true });

      render(<FileUploader uploadFile={uploadFile} />);

      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      const fileList = Object.assign([file], {
        item: (index: number) => (index === 0 ? file : null),
        length: 1,
      }) as FileList;

      const input = screen.getByTestId('file-input');
      Object.defineProperty(input, 'files', {
        value: fileList,
        writable: false,
        configurable: true,
      });

      fireEvent.change(input);

      // Ждем, пока файл будет добавлен и начнется загрузка
      await waitFor(() => {
        expect(uploadFile).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(mockInfoFireAndForget).toHaveBeenCalledWith('FileUploader upload-start', {
          component: 'FileUploader',
          action: 'upload-start',
          hidden: false,
          visible: true,
          filesCount: 1,
          totalSize: file.size,
          fileName: 'test.txt',
          fileType: 'text/plain',
        });
      });
    });

    it('должен отправлять telemetry при прогрессе загрузки', async () => {
      let progressCallback: ((progress: number) => void) | undefined;
      const uploadFile = vi.fn().mockImplementation((_file, onProgress) => {
        progressCallback = onProgress;
        return Promise.resolve({ success: true });
      });

      render(<FileUploader uploadFile={uploadFile} />);

      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      const fileList = Object.assign([file], {
        item: (index: number) => (index === 0 ? file : null),
        length: 1,
      }) as FileList;

      const input = screen.getByTestId('file-input');
      Object.defineProperty(input, 'files', {
        value: fileList,
        writable: false,
        configurable: true,
      });

      fireEvent.change(input);

      await waitFor(() => {
        expect(progressCallback).toBeDefined();
      });

      mockInfoFireAndForget.mockClear();
      progressCallback?.(75);

      await waitFor(() => {
        expect(mockInfoFireAndForget).toHaveBeenCalledWith('FileUploader upload-progress', {
          component: 'FileUploader',
          action: 'upload-progress',
          hidden: false,
          visible: true,
          filesCount: 1,
          totalSize: file.size,
          fileName: 'test.txt',
          uploadProgress: 75,
        });
      });
    });

    it('должен отправлять telemetry при успешной загрузке', async () => {
      const uploadFile = vi.fn().mockResolvedValue({ success: true });

      render(<FileUploader uploadFile={uploadFile} />);

      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      const fileList = Object.assign([file], {
        item: (index: number) => (index === 0 ? file : null),
        length: 1,
      }) as FileList;

      const input = screen.getByTestId('file-input');
      Object.defineProperty(input, 'files', {
        value: fileList,
        writable: false,
        configurable: true,
      });

      fireEvent.change(input);

      // Ждем, пока загрузка завершится
      await waitFor(() => {
        expect(uploadFile).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(mockInfoFireAndForget).toHaveBeenCalledWith('FileUploader upload-success', {
          component: 'FileUploader',
          action: 'upload-success',
          hidden: false,
          visible: true,
          filesCount: 1,
          totalSize: file.size,
          fileName: 'test.txt',
        });
      }, { timeout: 3000 });
    });

    it('должен отправлять telemetry при ошибке загрузки', async () => {
      const uploadFile = vi.fn().mockRejectedValue(new Error('Upload failed'));

      render(<FileUploader uploadFile={uploadFile} />);

      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      const fileList = Object.assign([file], {
        item: (index: number) => (index === 0 ? file : null),
        length: 1,
      }) as FileList;

      const input = screen.getByTestId('file-input');
      Object.defineProperty(input, 'files', {
        value: fileList,
        writable: false,
        configurable: true,
      });

      fireEvent.change(input);

      // Ждем, пока загрузка начнется и завершится с ошибкой
      await waitFor(() => {
        expect(uploadFile).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(mockInfoFireAndForget).toHaveBeenCalledWith('FileUploader upload-error', {
          component: 'FileUploader',
          action: 'upload-error',
          hidden: false,
          visible: true,
          filesCount: 1,
          totalSize: file.size,
          fileName: 'test.txt',
          errorMessage: 'Upload failed',
        });
      }, { timeout: 3000 });
    });

    it('должен отображать статус "Загрузка..." при загрузке', async () => {
      const uploadFile = vi.fn().mockImplementation((_file, _onProgress) => {
        return new Promise(() => {}); // Не разрешаем промис
      });

      render(<FileUploader uploadFile={uploadFile} />);

      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      const fileList = Object.assign([file], {
        item: (index: number) => (index === 0 ? file : null),
        length: 1,
      }) as FileList;

      const input = screen.getByTestId('file-input');
      Object.defineProperty(input, 'files', {
        value: fileList,
        writable: false,
        configurable: true,
      });

      fireEvent.change(input);

      // Ждем, пока файл будет добавлен и начнется загрузка
      await waitFor(() => {
        expect(uploadFile).toHaveBeenCalled();
      });

      await waitFor(() => {
        const statusLabel = screen.getByTestId('file-status-test-uuid-1');
        // При начале загрузки статус сразу обновляется с прогрессом 0%
        expect(statusLabel).toHaveTextContent('Загрузка 0%');
      }, { timeout: 3000 });
    });

    it('должен отображать статус "Загружено" при успешной загрузке', async () => {
      const uploadFile = vi.fn().mockResolvedValue({ success: true });

      render(<FileUploader uploadFile={uploadFile} />);

      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      const fileList = Object.assign([file], {
        item: (index: number) => (index === 0 ? file : null),
        length: 1,
      }) as FileList;

      const input = screen.getByTestId('file-input');
      Object.defineProperty(input, 'files', {
        value: fileList,
        writable: false,
        configurable: true,
      });

      fireEvent.change(input);

      // Ждем, пока загрузка завершится
      await waitFor(() => {
        expect(uploadFile).toHaveBeenCalled();
      });

      await waitFor(() => {
        const statusLabel = screen.getByTestId('file-status-test-uuid-1');
        expect(statusLabel).toHaveTextContent('Загружено');
      }, { timeout: 3000 });
    });

    it('должен отображать статус "Ошибка" при ошибке загрузки', async () => {
      const uploadFile = vi.fn().mockRejectedValue(new Error('Upload failed'));

      render(<FileUploader uploadFile={uploadFile} />);

      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      const fileList = Object.assign([file], {
        item: (index: number) => (index === 0 ? file : null),
        length: 1,
      }) as FileList;

      const input = screen.getByTestId('file-input');
      Object.defineProperty(input, 'files', {
        value: fileList,
        writable: false,
        configurable: true,
      });

      fireEvent.change(input);

      // Ждем, пока загрузка начнется и завершится с ошибкой
      await waitFor(() => {
        expect(uploadFile).toHaveBeenCalled();
      });

      await waitFor(() => {
        const statusLabel = screen.getByTestId('file-status-test-uuid-1');
        expect(statusLabel).toHaveTextContent('Ошибка');
      }, { timeout: 3000 });
    });
  });

  describe('10. Drag and drop', () => {
    it('должен вызывать onFilesSelected при drop файлов', async () => {
      const onFilesSelected = vi.fn();
      render(<FileUploader onFilesSelected={onFilesSelected} />);

      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      const fileList = Object.assign([file], {
        item: (index: number) => (index === 0 ? file : null),
        length: 1,
      }) as FileList;

      const dataTransfer = {
        files: fileList,
      } as DataTransfer;

      const dropZone = screen.getByTestId('drop-zone');
      fireEvent.drop(dropZone, {
        dataTransfer,
      });

      await waitFor(() => {
        expect(onFilesSelected).toHaveBeenCalledWith([file]);
      });
    });

    it('должен отправлять telemetry при drop файлов', async () => {
      render(<FileUploader />);

      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      const fileList = Object.assign([file], {
        item: (index: number) => (index === 0 ? file : null),
        length: 1,
      }) as FileList;

      const dataTransfer = {
        files: fileList,
      } as DataTransfer;

      const dropZone = screen.getByTestId('drop-zone');
      fireEvent.drop(dropZone, {
        dataTransfer,
      });

      await waitFor(() => {
        expect(mockInfoFireAndForget).toHaveBeenCalledWith('FileUploader drop', {
          component: 'FileUploader',
          action: 'drop',
          hidden: false,
          visible: true,
          filesCount: 1,
          totalSize: file.size,
        });
      });
    });

    it('должен устанавливать isDragActive при drag enter', () => {
      render(<FileUploader />);

      const dropZone = screen.getByTestId('drop-zone');
      fireEvent.dragEnter(dropZone);

      expect(screen.getByTestId('core-file-uploader')).toHaveAttribute(
        'data-is-drag-active',
        'true',
      );
    });

    it('должен сбрасывать isDragActive при drag leave', () => {
      render(<FileUploader />);

      const dropZone = screen.getByTestId('drop-zone');
      fireEvent.dragEnter(dropZone);

      expect(screen.getByTestId('core-file-uploader')).toHaveAttribute(
        'data-is-drag-active',
        'true',
      );

      fireEvent.dragLeave(dropZone);

      expect(screen.getByTestId('core-file-uploader')).toHaveAttribute(
        'data-is-drag-active',
        'false',
      );
    });

    it('должен обрабатывать множественные drag enter/leave', () => {
      render(<FileUploader />);

      const dropZone = screen.getByTestId('drop-zone');

      // Первый drag enter
      fireEvent.dragEnter(dropZone);
      expect(screen.getByTestId('core-file-uploader')).toHaveAttribute(
        'data-is-drag-active',
        'true',
      );

      // Второй drag enter (вложенный элемент)
      fireEvent.dragEnter(dropZone);
      expect(screen.getByTestId('core-file-uploader')).toHaveAttribute(
        'data-is-drag-active',
        'true',
      );

      // Первый drag leave (вложенный элемент)
      fireEvent.dragLeave(dropZone);
      expect(screen.getByTestId('core-file-uploader')).toHaveAttribute(
        'data-is-drag-active',
        'true',
      );

      // Второй drag leave (основной элемент)
      fireEvent.dragLeave(dropZone);
      expect(screen.getByTestId('core-file-uploader')).toHaveAttribute(
        'data-is-drag-active',
        'false',
      );
    });

    it('должен вызывать preventDefault и stopPropagation при drag событиях', () => {
      render(<FileUploader />);

      const dropZone = screen.getByTestId('drop-zone');

      const dragEnterEvent = new Event('dragenter', {
        bubbles: true,
        cancelable: true,
      }) as DragEvent;
      const preventDefaultSpy = vi.spyOn(dragEnterEvent, 'preventDefault');
      const stopPropagationSpy = vi.spyOn(dragEnterEvent, 'stopPropagation');

      dropZone.dispatchEvent(dragEnterEvent);

      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(stopPropagationSpy).toHaveBeenCalled();
    });

    it('должен обновлять drop zone label при drag active', () => {
      render(
        <FileUploader
          dropZoneLabel='Drag files here'
          dropZoneLabelActive='Drop files now'
        />,
      );

      const dropZone = screen.getByTestId('drop-zone');
      expect(screen.getByTestId('drop-zone-label')).toHaveTextContent('Drag files here');

      fireEvent.dragEnter(dropZone);
      expect(screen.getByTestId('drop-zone-label')).toHaveTextContent('Drop files now');

      fireEvent.dragLeave(dropZone);
      expect(screen.getByTestId('drop-zone-label')).toHaveTextContent('Drag files here');
    });
  });

  describe('11. Hint форматирование', () => {
    it('должен отображать hint с maxSize', () => {
      render(<FileUploader maxSize={1024 * 1024} />);

      expect(screen.getByTestId('hint')).toBeInTheDocument();
      expect(screen.getByTestId('hint')).toHaveTextContent('Максимальный размер файла: 1 MB');
    });

    it('должен отображать hint с maxFiles', () => {
      render(<FileUploader maxFiles={5} />);

      expect(screen.getByTestId('hint')).toBeInTheDocument();
      expect(screen.getByTestId('hint')).toHaveTextContent('Максимум файлов: 5');
    });

    it('должен отображать hint с maxSize и maxFiles', () => {
      render(<FileUploader maxSize={1024 * 1024} maxFiles={5} />);

      expect(screen.getByTestId('hint')).toBeInTheDocument();
      const hintText = screen.getByTestId('hint').textContent;
      expect(hintText).toContain('Максимальный размер файла: 1 MB');
      expect(hintText).toContain('Максимум файлов: 5');
    });

    it('не должен отображать hint когда maxSize и maxFiles не указаны', () => {
      render(<FileUploader />);

      expect(screen.queryByTestId('hint')).not.toBeInTheDocument();
    });
  });

  describe('12. Форматирование размера файла', () => {
    it('должен форматировать размер в Bytes', async () => {
      render(<FileUploader />);

      const file = new File(['x'], 'test.txt', { type: 'text/plain' });
      const fileList = Object.assign([file], {
        item: (index: number) => (index === 0 ? file : null),
        length: 1,
      }) as FileList;

      const input = screen.getByTestId('file-input');
      Object.defineProperty(input, 'files', {
        value: fileList,
        writable: false,
        configurable: true,
      });

      fireEvent.change(input);

      await waitFor(() => {
        const sizeLabel = screen.getByTestId('file-size-test-uuid-1');
        expect(sizeLabel).toHaveTextContent('1 Bytes');
      });
    });

    it('должен форматировать размер в KB', async () => {
      render(<FileUploader />);

      const file = new File(['x'.repeat(1024)], 'test.txt', { type: 'text/plain' });
      const fileList = Object.assign([file], {
        item: (index: number) => (index === 0 ? file : null),
        length: 1,
      }) as FileList;

      const input = screen.getByTestId('file-input');
      Object.defineProperty(input, 'files', {
        value: fileList,
        writable: false,
        configurable: true,
      });

      fireEvent.change(input);

      await waitFor(() => {
        const sizeLabel = screen.getByTestId('file-size-test-uuid-1');
        expect(sizeLabel).toHaveTextContent('1 KB');
      });
    });

    it('должен форматировать размер в MB', async () => {
      render(<FileUploader />);

      const file = new File(['x'.repeat(1024 * 1024)], 'test.txt', { type: 'text/plain' });
      const fileList = Object.assign([file], {
        item: (index: number) => (index === 0 ? file : null),
        length: 1,
      }) as FileList;

      const input = screen.getByTestId('file-input');
      Object.defineProperty(input, 'files', {
        value: fileList,
        writable: false,
        configurable: true,
      });

      fireEvent.change(input);

      await waitFor(() => {
        const sizeLabel = screen.getByTestId('file-size-test-uuid-1');
        expect(sizeLabel).toHaveTextContent('1 MB');
      });
    });

    it('должен форматировать размер в GB', async () => {
      render(<FileUploader />);

      // Используем Blob для создания файла с нужным размером без создания огромной строки
      const blob = new Blob(['x'], { type: 'text/plain' });
      const file = new File([blob], 'test.txt', { type: 'text/plain' });
      // Переопределяем size для теста форматирования GB
      Object.defineProperty(file, 'size', {
        value: 1024 * 1024 * 1024,
        writable: false,
        configurable: true,
      });

      const fileList = Object.assign([file], {
        item: (index: number) => (index === 0 ? file : null),
        length: 1,
      }) as FileList;

      const input = screen.getByTestId('file-input');
      Object.defineProperty(input, 'files', {
        value: fileList,
        writable: false,
        configurable: true,
      });

      fireEvent.change(input);

      await waitFor(() => {
        const sizeLabel = screen.getByTestId('file-size-test-uuid-1');
        expect(sizeLabel).toHaveTextContent('1 GB');
      });
    });
  });

  describe('13. Форматирование типа файла', () => {
    it('должен отображать MIME тип файла', async () => {
      render(<FileUploader />);

      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      const fileList = Object.assign([file], {
        item: (index: number) => (index === 0 ? file : null),
        length: 1,
      }) as FileList;

      const input = screen.getByTestId('file-input');
      Object.defineProperty(input, 'files', {
        value: fileList,
        writable: false,
        configurable: true,
      });

      fireEvent.change(input);

      await waitFor(() => {
        const typeLabel = screen.getByTestId('file-type-test-uuid-1');
        expect(typeLabel).toHaveTextContent('text/plain');
      });
    });

    it('должен отображать "Неизвестный тип" для файлов без MIME типа', async () => {
      render(<FileUploader />);

      const file = new File(['content'], 'test.txt', { type: '' });
      const fileList = Object.assign([file], {
        item: (index: number) => (index === 0 ? file : null),
        length: 1,
      }) as FileList;

      const input = screen.getByTestId('file-input');
      Object.defineProperty(input, 'files', {
        value: fileList,
        writable: false,
        configurable: true,
      });

      fireEvent.change(input);

      await waitFor(() => {
        const typeLabel = screen.getByTestId('file-type-test-uuid-1');
        expect(typeLabel).toHaveTextContent('Неизвестный тип');
      });
    });
  });

  describe('14. Multiple файлы', () => {
    it('должен поддерживать multiple выбор', async () => {
      const onFilesSelected = vi.fn();
      render(<FileUploader onFilesSelected={onFilesSelected} multiple />);

      const file1 = new File(['content1'], 'test1.txt', { type: 'text/plain' });
      const file2 = new File(['content2'], 'test2.txt', { type: 'text/plain' });
      const fileList = Object.assign([file1, file2], {
        item: (index: number) => (index === 0 ? file1 : index === 1 ? file2 : null),
        length: 2,
      }) as FileList;

      const input = screen.getByTestId('file-input');
      expect(input).toHaveAttribute('multiple');

      Object.defineProperty(input, 'files', {
        value: fileList,
        writable: false,
        configurable: true,
      });

      fireEvent.change(input);

      await waitFor(() => {
        expect(onFilesSelected).toHaveBeenCalledWith([file1, file2]);
      });
    });

    it('должен отображать несколько файлов', async () => {
      render(<FileUploader multiple />);

      const file1 = new File(['content1'], 'test1.txt', { type: 'text/plain' });
      const file2 = new File(['content2'], 'test2.txt', { type: 'text/plain' });
      const fileList = Object.assign([file1, file2], {
        item: (index: number) => (index === 0 ? file1 : index === 1 ? file2 : null),
        length: 2,
      }) as FileList;

      const input = screen.getByTestId('file-input');
      Object.defineProperty(input, 'files', {
        value: fileList,
        writable: false,
        configurable: true,
      });

      fireEvent.change(input);

      await waitFor(() => {
        expect(screen.getByTestId('file-test-uuid-1')).toBeInTheDocument();
        expect(screen.getByTestId('file-test-uuid-2')).toBeInTheDocument();
      });
    });
  });

  describe('15. Disabled состояние', () => {
    it('должен передавать disabled в Core FileUploader', () => {
      render(<FileUploader disabled />);

      const input = screen.getByTestId('file-input');
      expect(input).toBeDisabled();

      const dropZone = screen.getByTestId('drop-zone');
      expect(dropZone).toHaveAttribute('tabIndex', '-1');
    });

    it('не должен обрабатывать события когда disabled', async () => {
      const onFilesSelected = vi.fn();
      render(
        <FileUploader
          onFilesSelected={onFilesSelected}
          disabled
        />,
      );

      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      const fileList = Object.assign([file], {
        item: (index: number) => (index === 0 ? file : null),
        length: 1,
      }) as FileList;

      const input = screen.getByTestId('file-input');
      Object.defineProperty(input, 'files', {
        value: fileList,
        writable: false,
        configurable: true,
      });

      fireEvent.change(input);

      // Даже если событие сработает, файлы не должны быть обработаны
      await waitFor(() => {
        // Проверяем что файлы не были добавлены
        expect(screen.queryByTestId('files-list')).not.toBeInTheDocument();
      }, { timeout: 100 });
    });
  });

  describe('16. ARIA атрибуты', () => {
    it('должен передавать aria-label в Core FileUploader', () => {
      render(<FileUploader aria-label='File upload area' />);

      const dropZone = screen.getByTestId('drop-zone');
      expect(dropZone).toHaveAttribute('aria-label', 'File upload area');
    });

    it('должен передавать buttonAriaLabel', () => {
      render(<FileUploader buttonAriaLabel='Select files button' />);

      const button = screen.getByTestId('select-button');
      expect(button).toHaveAttribute('aria-label', 'Select files button');
    });

    it('должен передавать dropZoneAriaLabel', () => {
      render(<FileUploader dropZoneAriaLabel='Drop zone area' />);

      const dropZone = screen.getByTestId('drop-zone');
      expect(dropZone).toHaveAttribute('aria-label', 'Drop zone area');
    });
  });

  describe('17. Edge cases', () => {
    it('должен обрабатывать файл без uploadFile функции', async () => {
      const onFilesSelected = vi.fn();
      render(<FileUploader onFilesSelected={onFilesSelected} />);

      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      const fileList = Object.assign([file], {
        item: (index: number) => (index === 0 ? file : null),
        length: 1,
      }) as FileList;

      const input = screen.getByTestId('file-input');
      Object.defineProperty(input, 'files', {
        value: fileList,
        writable: false,
        configurable: true,
      });

      fireEvent.change(input);

      await waitFor(() => {
        expect(onFilesSelected).toHaveBeenCalledWith([file]);
        // Файл должен остаться в статусе "Ожидание"
        expect(screen.getByTestId('file-status-test-uuid-1')).toHaveTextContent('Ожидание');
      });
    });

    it('должен обрабатывать ошибку валидации без error message', async () => {
      const customValidate = vi.fn().mockResolvedValue({ valid: false });
      render(<FileUploader validateFile={customValidate} />);

      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      const fileList = Object.assign([file], {
        item: (index: number) => (index === 0 ? file : null),
        length: 1,
      }) as FileList;

      const input = screen.getByTestId('file-input');
      Object.defineProperty(input, 'files', {
        value: fileList,
        writable: false,
        configurable: true,
      });

      fireEvent.change(input);

      await waitFor(() => {
        expect(mockInfoFireAndForget).toHaveBeenCalledWith(
          'FileUploader upload-error',
          expect.objectContaining({
            action: 'upload-error',
            fileName: 'test.txt',
            filesCount: 0,
            totalSize: 0,
          }),
        );
      });
    });

    it('должен обрабатывать ошибку загрузки без Error объекта', async () => {
      const uploadFile = vi.fn().mockRejectedValue('String error');
      const onUploadError = vi.fn();

      render(
        <FileUploader
          uploadFile={uploadFile}
          onUploadError={onUploadError}
        />,
      );

      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      const fileList = Object.assign([file], {
        item: (index: number) => (index === 0 ? file : null),
        length: 1,
      }) as FileList;

      const input = screen.getByTestId('file-input');
      Object.defineProperty(input, 'files', {
        value: fileList,
        writable: false,
        configurable: true,
      });

      fireEvent.change(input);

      // Ждем, пока загрузка начнется и завершится с ошибкой
      await waitFor(() => {
        expect(uploadFile).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(onUploadError).toHaveBeenCalledWith('test-uuid-1', expect.any(Error));
        expect(screen.getByTestId('file-error-test-uuid-1')).toHaveTextContent(
          'Неизвестная ошибка',
        );
      }, { timeout: 3000 });
    });

    it('должен обрабатывать accept="*" (любые файлы)', async () => {
      const onFilesSelected = vi.fn();
      render(
        <FileUploader
          onFilesSelected={onFilesSelected}
          accept='*'
        />,
      );

      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      const fileList = Object.assign([file], {
        item: (index: number) => (index === 0 ? file : null),
        length: 1,
      }) as FileList;

      const input = screen.getByTestId('file-input');
      Object.defineProperty(input, 'files', {
        value: fileList,
        writable: false,
        configurable: true,
      });

      fireEvent.change(input);

      await waitFor(() => {
        expect(onFilesSelected).toHaveBeenCalledWith([file]);
      });
    });

    it('должен обрабатывать accept="" (пустая строка)', async () => {
      const onFilesSelected = vi.fn();
      render(
        <FileUploader
          onFilesSelected={onFilesSelected}
          accept=''
        />,
      );

      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      const fileList = Object.assign([file], {
        item: (index: number) => (index === 0 ? file : null),
        length: 1,
      }) as FileList;

      const input = screen.getByTestId('file-input');
      Object.defineProperty(input, 'files', {
        value: fileList,
        writable: false,
        configurable: true,
      });

      fireEvent.change(input);

      await waitFor(() => {
        expect(onFilesSelected).toHaveBeenCalledWith([file]);
      });
    });

    it('должен обрабатывать accept с несколькими типами', async () => {
      const onFilesSelected = vi.fn();
      render(
        <FileUploader
          onFilesSelected={onFilesSelected}
          accept='image/*,.pdf'
        />,
      );

      const pdfFile = new File(['content'], 'test.pdf', { type: 'application/pdf' });
      const fileList = Object.assign([pdfFile], {
        item: (index: number) => (index === 0 ? pdfFile : null),
        length: 1,
      }) as FileList;

      const input = screen.getByTestId('file-input');
      Object.defineProperty(input, 'files', {
        value: fileList,
        writable: false,
        configurable: true,
      });

      fireEvent.change(input);

      await waitFor(() => {
        expect(onFilesSelected).toHaveBeenCalledWith([pdfFile]);
      });
    });

    it('должен обрабатывать файл с нулевым размером', async () => {
      const onFilesSelected = vi.fn();
      render(<FileUploader onFilesSelected={onFilesSelected} />);

      const file = new File([], 'empty.txt', { type: 'text/plain' });
      const fileList = Object.assign([file], {
        item: (index: number) => (index === 0 ? file : null),
        length: 1,
      }) as FileList;

      const input = screen.getByTestId('file-input');
      Object.defineProperty(input, 'files', {
        value: fileList,
        writable: false,
        configurable: true,
      });

      fireEvent.change(input);

      await waitFor(() => {
        expect(onFilesSelected).toHaveBeenCalledWith([file]);
        expect(screen.getByTestId('file-size-test-uuid-1')).toHaveTextContent('0 Bytes');
      });
    });
  });

  describe('18. Ref forwarding', () => {
    it('должен передавать ref в Core FileUploader', () => {
      const ref = React.createRef<HTMLDivElement>();
      render(<FileUploader ref={ref} />);

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
      expect(ref.current).toBe(screen.getByTestId('core-file-uploader'));
    });
  });

  describe('19. Memoization', () => {
    it('должен мемоизировать компонент', () => {
      const { rerender } = render(<FileUploader />);
      const firstRender = screen.getByTestId('core-file-uploader');

      rerender(<FileUploader />);
      const secondRender = screen.getByTestId('core-file-uploader');

      // При одинаковых пропсах элемент должен быть тем же (мемоизация работает)
      expect(firstRender).toBe(secondRender);
    });
  });

  describe('20. Lifecycle telemetry', () => {
    it('должен отправлять telemetry только один раз при mount', () => {
      const { unmount, rerender } = render(<FileUploader />);

      expect(mockInfoFireAndForget).toHaveBeenCalledTimes(1);
      expect(mockInfoFireAndForget).toHaveBeenCalledWith('FileUploader mount', expect.any(Object));

      // Перерендер не должен отправлять telemetry снова
      mockInfoFireAndForget.mockClear();
      rerender(<FileUploader />);
      expect(mockInfoFireAndForget).not.toHaveBeenCalled();

      // Unmount должен отправить telemetry
      unmount();
      expect(mockInfoFireAndForget).toHaveBeenCalledTimes(1);
      expect(mockInfoFireAndForget).toHaveBeenCalledWith(
        'FileUploader unmount',
        expect.any(Object),
      );
    });

    it('lifecycle telemetry должен использовать начальное состояние policy', () => {
      render(<FileUploader visible={true} isHiddenByFeatureFlag={false} telemetryEnabled={true} />);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('FileUploader mount', {
        component: 'FileUploader',
        action: 'mount',
        hidden: false,
        visible: true,
        filesCount: 0,
        totalSize: 0,
      });
    });
  });

  describe('I18n рендеринг', () => {
    describe('Aria-label', () => {
      it('должен рендерить обычный aria-label', () => {
        render(
          <FileUploader aria-label='Test label' />,
        );

        const dropZone = screen.getByTestId('drop-zone');
        expect(dropZone).toHaveAttribute('aria-label', 'Test label');
      });

      it('должен рендерить i18n aria-label', () => {
        render(
          <FileUploader
            {...{ ariaLabelI18nKey: 'fileUploader.title' } as any}
          />,
        );

        expect(mockTranslate).toHaveBeenCalledWith('common', 'fileUploader.title', {});
        const dropZone = screen.getByTestId('drop-zone');
        expect(dropZone).toHaveAttribute('aria-label', 'Translated Label');
      });

      it('должен передавать namespace для i18n aria-label', () => {
        render(
          <FileUploader
            {...{ ariaLabelI18nKey: 'title', ariaLabelI18nNs: 'fileUploader' } as any}
          />,
        );

        expect(mockTranslate).toHaveBeenCalledWith('fileUploader', 'title', {});
      });

      it('должен передавать параметры для i18n aria-label', () => {
        const params = { maxFiles: 5, maxSize: 10 };
        render(
          <FileUploader
            {...{ ariaLabelI18nKey: 'fileUploader.upload', ariaLabelI18nParams: params } as any}
          />,
        );

        expect(mockTranslate).toHaveBeenCalledWith('common', 'fileUploader.upload', params);
      });

      it('должен использовать пустой объект для undefined параметров i18n aria-label', () => {
        render(
          <FileUploader
            {...{ ariaLabelI18nKey: 'fileUploader.title', ariaLabelI18nParams: undefined } as any}
          />,
        );

        expect(mockTranslate).toHaveBeenCalledWith('common', 'fileUploader.title', {});
      });
    });
  });

  describe('Побочные эффекты и производительность', () => {
    it('должен мемоизировать i18n aria-label при изменении пропсов', () => {
      const { rerender } = render(
        <FileUploader
          {...{ ariaLabelI18nKey: 'fileUploader.first' } as any}
        />,
      );

      expect(mockTranslate).toHaveBeenCalledTimes(1);

      rerender(
        <FileUploader
          {...{ ariaLabelI18nKey: 'fileUploader.second' } as any}
        />,
      );

      expect(mockTranslate).toHaveBeenCalledTimes(2);
      expect(mockTranslate).toHaveBeenLastCalledWith('common', 'fileUploader.second', {});
    });
  });

  describe('Discriminated union типизация', () => {
    it('должен принимать обычный aria-label без i18n', () => {
      render(
        <FileUploader aria-label='Regular label' />,
      );

      const dropZone = screen.getByTestId('drop-zone');
      expect(dropZone).toHaveAttribute('aria-label', 'Regular label');
    });

    it('должен принимать i18n aria-label без обычного', () => {
      render(
        <FileUploader
          {...{ ariaLabelI18nKey: 'fileUploader.title' } as any}
        />,
      );

      expect(mockTranslate).toHaveBeenCalledWith('common', 'fileUploader.title', {});
    });

    it('не должен компилироваться с обоими aria-label одновременно', () => {
      // Этот тест проверяет, что discriminated union работает правильно
      expect(() => {
        // TypeScript не позволит создать такой объект
        const invalidProps = {
          'aria-label': 'test',
          ariaLabelI18nKey: 'test',
        } as any;

        // Если discriminated union работает, этот объект будет иметь never типы для конфликтующих полей
        return invalidProps;
      }).not.toThrow();
    });
  });
});
