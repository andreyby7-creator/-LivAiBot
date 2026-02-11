/**
 * @file packages/ui-core/src/components/FileUploader.tsx
 * ============================================================================
 * 🔵 CORE UI FILEUPLOADER — PRESENTATIONAL PRIMITIVE
 * ============================================================================
 *
 * Роль:
 * - Базовый UI-компонент для загрузки файлов
 * - Полностью детерминированный и side-effect free
 * - SSR-safe, Concurrent-safe
 *
 * Не содержит:
 * - Feature flags
 * - Telemetry
 * - Управление состоянием (принимает готовое состояние)
 * - Валидацию файлов (принимает уже валидированные файлы)
 * - Логику загрузки на сервер
 * - Форматирование данных (принимает уже отформатированные строки)
 * - Внутреннее UI-состояние (drag state приходит извне)
 *
 * Управление:
 * - Выбором файлов и событиями управляет App-слой
 * - Валидацией файлов управляет App-слой
 * - Состоянием загрузки управляет App-слой
 * - Форматированием данных управляет App-слой
 */

import { forwardRef, memo, useCallback, useMemo, useRef } from 'react';
import type {
  ChangeEvent,
  CSSProperties,
  DragEvent,
  HTMLAttributes,
  JSX,
  KeyboardEvent,
  MouseEvent,
  Ref,
} from 'react';

import type { UITestId } from '../types/ui.js';

/* ============================================================================
 * 🧬 TYPES & CONSTANTS
 * ========================================================================== */

/** Базовые поля файла */
type FileBase = Readonly<{
  /** Уникальный идентификатор файла (для key в React) */
  id: string;

  /** Имя файла */
  name: string;

  /** Размер файла (уже отформатированная строка, например "1.5 MB") */
  sizeLabel: string;

  /** Тип файла (MIME или описание) */
  typeLabel: string;
}>;

/** Статус файла для отображения (визуальное состояние) */
export type FileStatus =
  | Readonly<{ type: 'pending'; label: string; }>
  | Readonly<{ type: 'success'; label: string; }>
  | Readonly<{ type: 'progress'; label: string; }>
  | Readonly<{ type: 'error'; label: string; }>;

/** Информация о файле для отображения (discriminated union для строгой типизации) */
export type FileInfo =
  | Readonly<FileBase & { status: Extract<FileStatus, { type: 'pending'; }>; }>
  | Readonly<FileBase & { status: Extract<FileStatus, { type: 'success'; }>; }>
  | Readonly<FileBase & { status: Extract<FileStatus, { type: 'progress'; }>; progress: number; }>
  | Readonly<FileBase & { status: Extract<FileStatus, { type: 'error'; }>; errorMessage: string; }>;

export type CoreFileUploaderProps = Readonly<
  Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'onChange' | 'onDrop'> & {
    /** Список файлов для отображения */
    files: readonly FileInfo[];

    /** Принимает ли компонент множественный выбор */
    multiple?: boolean;

    /** Принимаемые MIME типы (например, "image/*", "application/pdf") */
    accept?: string;

    /** Disabled состояние */
    disabled?: boolean;

    /** Активен ли drag-and-drop (управляется App-слоем) */
    isDragActive?: boolean;

    /** Текст для кнопки выбора файлов */
    buttonLabel?: string;

    /** Текст для drag-and-drop зоны */
    dropZoneLabel?: string;

    /** Текст для drag-and-drop зоны при активном drag */
    dropZoneLabelActive?: string;

    /** Подсказка о лимитах (уже отформатированная строка) */
    hint?: string;

    /** ARIA: основной лейбл для компонента */
    'aria-label'?: string;

    /** ARIA: лейбл для кнопки выбора файлов */
    buttonAriaLabel?: string;

    /** ARIA: лейбл для drag-and-drop зоны */
    dropZoneAriaLabel?: string;

    /** Callback при выборе файлов через input */
    onChange?: (files: File[], event: ChangeEvent<HTMLInputElement>) => void;

    /** Callback при drop файлов */
    onDrop?: (files: File[], event: DragEvent<HTMLDivElement>) => void;

    /** Callback при удалении файла */
    onRemove?: (
      fileId: string,
      event: MouseEvent<HTMLButtonElement> | KeyboardEvent<HTMLButtonElement>,
    ) => void;

    /** Callback при клике на кнопку выбора файлов */
    onButtonClick?: (event: MouseEvent<HTMLButtonElement>) => void;

    /** Callback при drag enter */
    onDragEnter?: (event: DragEvent<HTMLDivElement>) => void;

    /** Callback при drag leave */
    onDragLeave?: (event: DragEvent<HTMLDivElement>) => void;

    /** Callback при drag over */
    onDragOver?: (event: DragEvent<HTMLDivElement>) => void;

    /** Test ID для автотестов */
    'data-testid'?: UITestId;

    /** Data state для унифицированной диагностики (App слой) */
    'data-state'?: string;
  }
>;

/* ============================================================================
 * 🎨 BASE STYLES
 * ========================================================================== */

const CONTAINER_STYLE: CSSProperties = {
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  gap: '12px',
};

const DROP_ZONE_STYLE: CSSProperties = {
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '32px',
  border: '2px dashed var(--fileuploader-border-color, #d1d5db)',
  borderRadius: '8px',
  backgroundColor: 'var(--fileuploader-bg-color, #f9fafb)',
  cursor: 'pointer',
  transition: 'border-color 0.2s ease, background-color 0.2s ease',
  minHeight: '120px',
};

const DROP_ZONE_ACTIVE_STYLE: CSSProperties = {
  ...DROP_ZONE_STYLE,
  borderColor: 'var(--fileuploader-border-active-color, #3b82f6)',
  backgroundColor: 'var(--fileuploader-bg-active-color, #eff6ff)',
};

const DROP_ZONE_DISABLED_STYLE: CSSProperties = {
  ...DROP_ZONE_STYLE,
  opacity: 0.5,
  cursor: 'not-allowed',
  pointerEvents: 'none',
};

const DROP_ZONE_LABEL_STYLE: CSSProperties = {
  fontSize: '14px',
  color: 'var(--fileuploader-text-color, #6b7280)',
  textAlign: 'center',
  marginBottom: '8px',
};

const DROP_ZONE_LABEL_ACTIVE_STYLE: CSSProperties = {
  ...DROP_ZONE_LABEL_STYLE,
  color: 'var(--fileuploader-text-active-color, #3b82f6)',
  fontWeight: '500',
};

const BUTTON_STYLE: CSSProperties = {
  padding: '8px 16px',
  fontSize: '14px',
  fontWeight: '500',
  color: 'var(--fileuploader-button-text-color, #ffffff)',
  backgroundColor: 'var(--fileuploader-button-bg-color, #3b82f6)',
  border: 'none',
  borderRadius: '6px',
  cursor: 'pointer',
  transition: 'background-color 0.2s ease',
  outline: 'none',
};

const BUTTON_DISABLED_STYLE: CSSProperties = {
  ...BUTTON_STYLE,
  opacity: 0.5,
  cursor: 'not-allowed',
  backgroundColor: 'var(--fileuploader-button-disabled-bg-color, #9ca3af)',
};

const FILE_LIST_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  width: '100%',
};

const FILE_ITEM_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px',
  border: '1px solid var(--fileuploader-file-border-color, #e5e7eb)',
  borderRadius: '6px',
  backgroundColor: 'var(--fileuploader-file-bg-color, #ffffff)',
  gap: '12px',
};

const FILE_INFO_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minWidth: 0,
  gap: '4px',
};

const FILE_NAME_STYLE: CSSProperties = {
  fontSize: '14px',
  fontWeight: '500',
  color: 'var(--fileuploader-file-name-color, #111827)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const FILE_META_STYLE: CSSProperties = {
  fontSize: '12px',
  color: 'var(--fileuploader-file-meta-color, #6b7280)',
};

const FILE_STATUS_STYLE: CSSProperties = {
  fontSize: '12px',
  fontWeight: '500',
  padding: '2px 8px',
  borderRadius: '4px',
};

const FILE_STATUS_PENDING_STYLE: CSSProperties = {
  ...FILE_STATUS_STYLE,
  color: 'var(--fileuploader-status-pending-color, #6b7280)',
  backgroundColor: 'var(--fileuploader-status-pending-bg-color, #f3f4f6)',
};

const FILE_STATUS_PROGRESS_STYLE: CSSProperties = {
  ...FILE_STATUS_STYLE,
  color: 'var(--fileuploader-status-progress-color, #3b82f6)',
  backgroundColor: 'var(--fileuploader-status-progress-bg-color, #dbeafe)',
};

const FILE_STATUS_SUCCESS_STYLE: CSSProperties = {
  ...FILE_STATUS_STYLE,
  color: 'var(--fileuploader-status-success-color, #10b981)',
  backgroundColor: 'var(--fileuploader-status-success-bg-color, #d1fae5)',
};

const FILE_STATUS_ERROR_STYLE: CSSProperties = {
  ...FILE_STATUS_STYLE,
  color: 'var(--fileuploader-status-error-color, #ef4444)',
  backgroundColor: 'var(--fileuploader-status-error-bg-color, #fee2e2)',
};

const REMOVE_BUTTON_STYLE: CSSProperties = {
  padding: '4px 8px',
  fontSize: '12px',
  fontWeight: '500',
  color: 'var(--fileuploader-remove-text-color, #ef4444)',
  backgroundColor: 'transparent',
  border: '1px solid var(--fileuploader-remove-border-color, #ef4444)',
  borderRadius: '4px',
  cursor: 'pointer',
  transition: 'background-color 0.2s ease, color 0.2s ease',
  outline: 'none',
};

const PROGRESS_BAR_CONTAINER_STYLE: CSSProperties = {
  width: '100%',
  height: '4px',
  backgroundColor: 'var(--fileuploader-progress-bg-color, #e5e7eb)',
  borderRadius: '2px',
  overflow: 'hidden',
  marginTop: '8px',
};

const PROGRESS_BAR_FILL_STYLE: CSSProperties = {
  height: '100%',
  backgroundColor: 'var(--fileuploader-progress-fill-color, #3b82f6)',
  transition: 'width 0.3s ease',
};

const HIDDEN_INPUT_STYLE: CSSProperties = {
  position: 'absolute',
  width: 0,
  height: 0,
  opacity: 0,
  overflow: 'hidden',
  pointerEvents: 'none',
};

const HINT_STYLE: CSSProperties = {
  fontSize: '12px',
  color: 'var(--fileuploader-hint-color, #6b7280)',
};

/* ============================================================================
 * 🎯 PROGRESS BAR COMPONENT
 * ========================================================================== */

/** Компонент прогресс-бара для файла */
function ProgressBar(props: Readonly<{ progress: number; }>): JSX.Element {
  const progressStyle = useMemo(() => ({
    ...PROGRESS_BAR_FILL_STYLE,
    width: `${props.progress}%`,
  }), [props.progress]);

  return (
    <div style={PROGRESS_BAR_CONTAINER_STYLE}>
      <div
        style={progressStyle}
        role='progressbar'
        aria-valuenow={props.progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Прогресс загрузки: ${props.progress}%`}
      />
    </div>
  );
}

/* ============================================================================
 * 🎯 CORE FILEUPLOADER
 * ========================================================================== */

const CoreFileUploaderComponent = forwardRef<HTMLDivElement, CoreFileUploaderProps>(
  function CoreFileUploaderComponent(props, ref: Ref<HTMLDivElement>): JSX.Element {
    const {
      files = [],
      multiple = false,
      accept,
      disabled = false,
      isDragActive = false,
      buttonLabel = 'Выбрать файлы',
      dropZoneLabel = 'Перетащите файлы сюда или',
      dropZoneLabelActive = 'Отпустите файлы для загрузки',
      hint,
      onChange,
      onDrop,
      onRemove,
      onButtonClick,
      onDragEnter,
      onDragLeave,
      onDragOver,
      style,
      className,
      'data-testid': testId,
      'data-state': dataState,
      'aria-label': ariaLabel,
      'aria-labelledby': ariaLabelledBy,
      buttonAriaLabel,
      dropZoneAriaLabel,
      ...rest
    } = props;

    const fileInputRef = useRef<HTMLInputElement>(null);

    const containerStyle: CSSProperties = useMemo(() => ({
      ...CONTAINER_STYLE,
      ...style,
    }), [style]);

    // Мемоизация стилей для контейнера файлов
    const fileContainerStyle = useMemo(
      () => ({ display: 'flex', alignItems: 'center', gap: '8px' }),
      [],
    );

    const effectiveDropZoneStyle: CSSProperties = useMemo(() => {
      if (Boolean(disabled)) return DROP_ZONE_DISABLED_STYLE;
      if (Boolean(isDragActive)) return DROP_ZONE_ACTIVE_STYLE;
      return DROP_ZONE_STYLE;
    }, [disabled, isDragActive]);

    const effectiveDropZoneLabel: string = useMemo(() => {
      if (Boolean(isDragActive)) return dropZoneLabelActive;
      return dropZoneLabel;
    }, [isDragActive, dropZoneLabel, dropZoneLabelActive]);

    const effectiveDropZoneLabelStyle: CSSProperties = useMemo(() => {
      if (Boolean(isDragActive)) return DROP_ZONE_LABEL_ACTIVE_STYLE;
      return DROP_ZONE_LABEL_STYLE;
    }, [isDragActive]);

    const buttonStyle: CSSProperties = useMemo(() => {
      if (Boolean(disabled)) return BUTTON_DISABLED_STYLE;
      return BUTTON_STYLE;
    }, [disabled]);

    /** Обработка выбора файлов через input */
    const handleFileInputChange = useCallback((event: ChangeEvent<HTMLInputElement>): void => {
      const selectedFiles = event.target.files;
      if (selectedFiles !== null && selectedFiles.length > 0) {
        const fileArray = Array.from(selectedFiles);
        onChange?.(fileArray, event);
      }
      // Сбрасываем значение input для возможности повторного выбора того же файла
      if (fileInputRef.current !== null) {
        fileInputRef.current.value = '';
      }
    }, [onChange]);

    /** Обработка клика на кнопку выбора файлов */
    const handleButtonClick = useCallback((event: MouseEvent<HTMLButtonElement>): void => {
      if (Boolean(disabled)) return;
      onButtonClick?.(event);
      fileInputRef.current?.click();
    }, [disabled, onButtonClick]);

    /** Обработка drop файлов */
    const handleDrop = useCallback((event: DragEvent<HTMLDivElement>): void => {
      event.preventDefault();
      event.stopPropagation();

      if (Boolean(disabled)) return;

      const droppedFiles = event.dataTransfer.files;
      if (droppedFiles.length > 0) {
        const fileArray = Array.from(droppedFiles);
        onDrop?.(fileArray, event);
      }
    }, [disabled, onDrop]);

    /** Обработка drag enter */
    const handleDragEnter = useCallback((event: DragEvent<HTMLDivElement>): void => {
      event.preventDefault();
      event.stopPropagation();

      if (Boolean(disabled)) return;

      onDragEnter?.(event);
    }, [disabled, onDragEnter]);

    /** Обработка drag leave */
    const handleDragLeave = useCallback((event: DragEvent<HTMLDivElement>): void => {
      event.preventDefault();
      event.stopPropagation();

      if (Boolean(disabled)) return;

      onDragLeave?.(event);
    }, [disabled, onDragLeave]);

    /** Обработка drag over */
    const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>): void => {
      event.preventDefault();
      event.stopPropagation();

      if (Boolean(disabled)) return;

      onDragOver?.(event);
    }, [disabled, onDragOver]);

    /** Обработка удаления файла */
    const handleRemoveFile = useCallback(
      (fileId: string) =>
      (event: MouseEvent<HTMLButtonElement> | KeyboardEvent<HTMLButtonElement>): void => {
        if (Boolean(disabled)) return;
        onRemove?.(fileId, event);
      },
      [disabled, onRemove],
    );

    /** Обработка keyboard navigation для drop zone */
    const handleDropZoneKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>): void => {
      if (Boolean(disabled)) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        fileInputRef.current?.click();
      }
    }, [disabled]);

    /** Обработка keyboard navigation для кнопки удаления */
    const handleRemoveKeyDown = useCallback(
      (fileId: string) => (event: KeyboardEvent<HTMLButtonElement>): void => {
        if (Boolean(disabled)) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onRemove?.(fileId, event);
        }
      },
      [disabled, onRemove],
    );

    /** Получение стиля статуса файла */
    const getFileStatusStyle = useCallback((status: FileInfo['status']): CSSProperties => {
      switch (status.type) {
        case 'progress':
          return FILE_STATUS_PROGRESS_STYLE;
        case 'success':
          return FILE_STATUS_SUCCESS_STYLE;
        case 'error':
          return FILE_STATUS_ERROR_STYLE;
        case 'pending':
        default:
          return FILE_STATUS_PENDING_STYLE;
      }
    }, []);

    // ID для hint (для aria-describedby)
    const hintId = useMemo(() => {
      if (hint === undefined || hint === '') return undefined;
      return testId !== undefined && testId !== '' ? `${testId}-hint` : 'fileuploader-hint';
    }, [hint, testId]);

    return (
      <div
        ref={ref}
        data-component='CoreFileUploader'
        data-state={dataState ?? (Boolean(disabled) ? 'disabled' : 'enabled')}
        data-testid={testId}
        style={containerStyle}
        className={className}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={hintId}
        {...rest}
      >
        {/* Скрытый input для выбора файлов */}
        <input
          ref={fileInputRef}
          type='file'
          multiple={multiple}
          accept={accept}
          disabled={disabled}
          onChange={handleFileInputChange}
          style={HIDDEN_INPUT_STYLE}
          aria-hidden='true'
          data-testid={testId !== undefined && testId !== '' ? `${testId}-input` : undefined}
        />

        {/* Drop zone */}
        <div
          style={effectiveDropZoneStyle}
          onDrop={handleDrop}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onKeyDown={handleDropZoneKeyDown}
          role='button'
          tabIndex={Boolean(disabled) ? -1 : 0}
          aria-label={dropZoneAriaLabel ?? ariaLabel ?? 'Drag and drop zone for file upload'}
          aria-disabled={disabled}
          data-testid={testId !== undefined && testId !== '' ? `${testId}-dropzone` : undefined}
        >
          <div style={effectiveDropZoneLabelStyle}>{effectiveDropZoneLabel}</div>
          <button
            type='button'
            onClick={handleButtonClick}
            disabled={disabled}
            style={buttonStyle}
            aria-label={buttonAriaLabel ?? ariaLabel ?? buttonLabel}
            data-testid={testId !== undefined && testId !== '' ? `${testId}-button` : undefined}
          >
            {buttonLabel}
          </button>
        </div>

        {/* Список файлов */}
        {files.length > 0 && (
          <div
            style={FILE_LIST_STYLE}
            role='list'
            aria-label='Список выбранных файлов'
            data-testid={testId !== undefined && testId !== '' ? `${testId}-file-list` : undefined}
          >
            {files.map((file) => (
              <div
                key={file.id}
                style={FILE_ITEM_STYLE}
                role='listitem'
                aria-label={`Файл: ${file.name}`}
                data-testid={testId !== undefined && testId !== ''
                  ? `${testId}-file-${file.id}`
                  : undefined}
              >
                <div style={FILE_INFO_STYLE}>
                  <div style={FILE_NAME_STYLE} title={file.name}>
                    {file.name}
                  </div>
                  <div style={FILE_META_STYLE}>
                    {file.sizeLabel} • {file.typeLabel}
                  </div>
                  {file.status.type === 'progress' && 'progress' in file && (
                    <ProgressBar progress={file.progress} />
                  )}
                  {file.status.type === 'error' && 'errorMessage' in file && (
                    <div
                      style={FILE_STATUS_ERROR_STYLE}
                      role='alert'
                      aria-live='polite'
                    >
                      {file.errorMessage}
                    </div>
                  )}
                </div>
                <div style={fileContainerStyle}>
                  <div style={getFileStatusStyle(file.status)}>
                    {file.status.label}
                  </div>
                  {onRemove !== undefined && (
                    <button
                      type='button'
                      onClick={handleRemoveFile(file.id)}
                      onKeyDown={handleRemoveKeyDown(file.id)}
                      disabled={disabled}
                      style={REMOVE_BUTTON_STYLE}
                      aria-label={`Удалить файл ${file.name}`}
                      data-testid={testId !== undefined && testId !== ''
                        ? `${testId}-remove-${file.id}`
                        : undefined}
                    >
                      Удалить
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Подсказка о лимитах */}
        {hint !== undefined && hint !== '' && hintId !== undefined && (
          <div
            id={hintId}
            style={HINT_STYLE}
            role='note'
            aria-live='polite'
          >
            {hint}
          </div>
        )}
      </div>
    );
  },
);

/**
 * Memoized CoreFileUploader.
 *
 * Гарантии:
 * - Полностью детерминированный
 * - Side-effect free
 * - SSR и concurrent safe
 * - Поддержка ref forwarding
 * - Подходит как базовый building-block для App-слоя
 */
export const FileUploader = memo(CoreFileUploaderComponent);

/* ============================================================================
 * 🧪 ARCHITECTURAL NOTES
 * ========================================================================== */

/**
 * CoreFileUploader — это чистый presentational primitive:
 *
 * - Не управляет состоянием файлов (принимает готовый список files)
 * - Не валидирует файлы (валидация должна быть в App-слое)
 * - Не загружает файлы на сервер (логика загрузки в App-слое)
 * - Не форматирует данные (размер, тип приходят уже отформатированными)
 * - Не имеет внутреннего UI-состояния (drag state приходит извне)
 * - Не имеет встроенных анимаций
 * - Поддерживает ref forwarding
 *
 * Любая бизнес-логика:
 * - выбор файлов
 * - валидация файлов
 * - загрузка на сервер
 * - управление состоянием загрузки
 * - обработка ошибок
 * - форматирование данных
 * - управление drag state
 *
 * должна реализовываться на App-слое.
 *
 * Это гарантирует:
 * - переиспользуемость
 * - тестируемость
 * - архитектурную чистоту
 *
 * CSS переменные для темизации:
 * - --fileuploader-border-color: цвет границы drop zone
 * - --fileuploader-border-active-color: цвет границы при drag over
 * - --fileuploader-bg-color: фон drop zone
 * - --fileuploader-bg-active-color: фон drop zone при drag over
 * - --fileuploader-text-color: цвет текста
 * - --fileuploader-text-active-color: цвет текста при drag over
 * - --fileuploader-button-bg-color: фон кнопки
 * - --fileuploader-button-disabled-bg-color: фон кнопки в disabled состоянии
 * - --fileuploader-file-border-color: цвет границы элемента файла
 * - --fileuploader-file-bg-color: фон элемента файла
 * - --fileuploader-status-*: цвета статусов загрузки
 * - --fileuploader-progress-*: цвета прогресс-бара
 */
