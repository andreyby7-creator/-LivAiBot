/**
 * @file packages/app/src/ui/file-uploader.tsx
 * ============================================================================
 * 🟥 APP UI FILEUPLOADER — UI МИКРОСЕРВИС FILEUPLOADER
 * ============================================================================
 * Единственная точка входа для FileUploader в приложении.
 * UI boundary между ui-core и бизнес-логикой.
 * Ответственность:
 * - Policy (hidden / visibility)
 * - Telemetry
 * - Feature flags
 * - Валидация файлов
 * - Управление состоянием загрузки
 * - Конвертация File в FileInfo
 * - Форматирование данных (размер, тип)
 * - Управление drag state
 * Не содержит:
 * - DOM-манипуляций кроме Core
 * - Платформенных эффектов
 */

import type { DragEvent, JSX, Ref } from 'react';
import { forwardRef, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { formatFileSize, validateFileBasic } from '@livai/core/effect';
import type { CoreFileUploaderProps, FileInfo } from '@livai/ui-core/components/FileUploader';
import { FileUploader as CoreFileUploader } from '@livai/ui-core/components/FileUploader';

import type { Namespace, TranslationKey } from '../lib/i18n.js';
import { useUnifiedUI } from '../providers/UnifiedUIProvider.js';
import type {
  AppFileStatus,
  FileValidationResult,
  InternalFileInfo,
  UploadDomainStatus,
} from '../types/api.js';
import type { UiTelemetryApi } from '../types/ui-contracts.js';

/* ============================================================================
 * 🧬 TYPES & CONSTANTS
 * ========================================================================== */

/** Бизнес-пропсы, которые не должны попадать в DOM */
const BUSINESS_PROPS = [
  'visible',
  'isHiddenByFeatureFlag',
  'telemetryEnabled',
  'onFilesSelected',
  'onFileRemove',
  'onUploadStart',
  'onUploadProgress',
  'onUploadSuccess',
  'onUploadError',
  'uploadFile',
  'validateFile',
  'maxSize',
  'maxFiles',
  'ariaLabelI18nKey',
  'ariaLabelI18nNs',
  'ariaLabelI18nParams',
] as const;

/** Функция для фильтрации бизнес-пропсов */
function omit<T extends Record<string, unknown>, K extends readonly string[]>(
  obj: T,
  keys: K,
): Omit<T, K[number]> {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result;
}

enum FileUploaderTelemetryAction {
  Mount = 'mount',
  Unmount = 'unmount',
  Select = 'select',
  Drop = 'drop',
  Remove = 'remove',
  UploadStart = 'upload-start',
  UploadProgress = 'upload-progress',
  UploadSuccess = 'upload-success',
  UploadError = 'upload-error',
}

type FileUploaderTelemetryPayload = Readonly<{
  component: 'FileUploader';
  action: FileUploaderTelemetryAction;
  hidden: boolean;
  visible: boolean;
  filesCount: number;
  totalSize: number;
  fileType?: string;
  fileName?: string;
  uploadProgress?: number;
  errorMessage?: string;
}>;

/** Стабильная ссылка на пустой объект параметров */
const EMPTY_PARAMS: Record<string, string | number> = Object.freeze({});

/** Базовые поля для telemetry payload */
type TelemetryBase = Readonly<{
  component: 'FileUploader';
  hidden: boolean;
  visible: boolean;
  filesCount: number;
  totalSize: number;
}>;

export type AppFileUploaderProps = Readonly<
  & Omit<
    CoreFileUploaderProps,
    'files' | 'onChange' | 'onDrop' | 'onRemove' | 'isDragActive' | 'hint' | 'aria-label'
  >
  & {
    /** Callback при успешном выборе файлов (после валидации) */
    onFilesSelected?: (files: File[]) => void;

    /** Callback при удалении файла */
    onFileRemove?: (fileId: string) => void;

    /** Callback при начале загрузки файла */
    onUploadStart?: (fileId: string, file: File) => void;

    /** Callback при прогрессе загрузки */
    onUploadProgress?: (fileId: string, progress: number) => void;

    /** Callback при успешной загрузке */
    onUploadSuccess?: (fileId: string, response: unknown) => void;

    /** Callback при ошибке загрузки */
    onUploadError?: (fileId: string, error: Error) => void;

    /** Функция загрузки файла на сервер */
    uploadFile?: (file: File, onProgress: (progress: number) => void) => Promise<unknown>;

    /** Видимость FileUploader (App policy) */
    visible?: boolean;

    /** Feature flag: скрыть FileUploader */
    isHiddenByFeatureFlag?: boolean;

    /** Telemetry master switch */
    telemetryEnabled?: boolean;

    /** Кастомные правила валидации */
    validateFile?: (file: File) => FileValidationResult | Promise<FileValidationResult>;

    /** Максимальный размер файла в байтах */
    maxSize?: number;

    /** Максимальное количество файлов */
    maxFiles?: number;

    /** Disabled состояние */
    disabled?: boolean;

    /** Test ID для автотестов */
    'data-testid'?: string;
  }
  & (
    | {
      /** I18n aria-label режим */
      ariaLabelI18nKey: TranslationKey;
      ariaLabelI18nNs?: Namespace;
      ariaLabelI18nParams?: Record<string, string | number>;
      'aria-label'?: never;
    }
    | {
      /** Обычный aria-label режим */
      ariaLabelI18nKey?: never;
      ariaLabelI18nNs?: never;
      ariaLabelI18nParams?: never;
      'aria-label'?: string;
    }
  )
>;

/* ============================================================================
 * 🧠 POLICY
 * ========================================================================== */

type FileUploaderPolicy = Readonly<{
  readonly hiddenByFeatureFlag: boolean;
  readonly isRendered: boolean;
  readonly telemetryEnabled: boolean;
}>;

/**
 * FileUploaderPolicy является единственным источником истины
 * для:
 * - DOM rendering
 * - telemetry
 * - visibility state
 * Ни один consumer не имеет права повторно интерпретировать props.visible
 * или feature flags.
 */
function useFileUploaderPolicy(props: AppFileUploaderProps): FileUploaderPolicy {
  const hiddenByFlag = Boolean(props.isHiddenByFeatureFlag);

  return useMemo(() => {
    const isRendered = !hiddenByFlag && props.visible !== false;
    return {
      hiddenByFeatureFlag: hiddenByFlag,
      isRendered,
      telemetryEnabled: props.telemetryEnabled !== false,
    };
  }, [hiddenByFlag, props.visible, props.telemetryEnabled]);
}

/* ============================================================================
 * 📡 TELEMETRY
 * ========================================================================== */

/** Внутренний тип для хранения состояния файлов (единственный источник истины) */

/**
 * Фабрика базовых полей для telemetry payload
 * Гарантирует единообразие и снижает риск рассинхрона
 */
function makeTelemetryBase(
  policy: FileUploaderPolicy,
  files: readonly InternalFileInfo[],
): TelemetryBase {
  return {
    component: 'FileUploader',
    hidden: policy.hiddenByFeatureFlag,
    visible: policy.isRendered,
    filesCount: files.length,
    totalSize: files.reduce((sum, f) => sum + f.file.size, 0),
  };
}

function emitFileUploaderTelemetry(
  telemetry: UiTelemetryApi,
  payload: FileUploaderTelemetryPayload,
): void {
  const serializedPayload: Readonly<Record<string, string | number | boolean | null>> = {
    component: payload.component,
    action: payload.action,
    hidden: payload.hidden,
    visible: payload.visible,
    filesCount: payload.filesCount,
    totalSize: payload.totalSize,
    ...(payload.fileType !== undefined ? { fileType: payload.fileType } : {}),
    ...(payload.fileName !== undefined ? { fileName: payload.fileName } : {}),
    ...(payload.uploadProgress !== undefined ? { uploadProgress: payload.uploadProgress } : {}),
    ...(payload.errorMessage !== undefined ? { errorMessage: payload.errorMessage } : {}),
  };
  telemetry.infoFireAndForget(`FileUploader ${payload.action}`, serializedPayload);
}

/* ============================================================================
 * 🔍 VALIDATION & FORMATTING
 * ========================================================================== */

/** Константы для форматирования размера файла */

/**
 * Валидация файла по базовым правилам (размер, тип, количество)
 */

/**
 * Форматирование типа файла
 */
function formatFileType(mimeType: string): string {
  if (mimeType === '') return 'Неизвестный тип';
  return mimeType;
}

/**
 * Форматирование hint о лимитах
 */
function formatHint(maxSize?: number, maxFiles?: number): string | undefined {
  const parts: readonly string[] = [
    ...(maxSize !== undefined ? [`Максимальный размер файла: ${formatFileSize(maxSize)}`] : []),
    ...(maxFiles !== undefined ? [`Максимум файлов: ${maxFiles}`] : []),
  ];
  return parts.length > 0 ? parts.join(' • ') : undefined;
}

/**
 * Маппинг domain статуса в UI статус
 * Разделяет domain-логику от UI-представления
 */
function mapUploadStatusToFileStatus(
  uploadStatus: UploadDomainStatus,
  progress?: number,
): AppFileStatus {
  switch (uploadStatus) {
    case 'uploading':
      return {
        type: 'progress',
        label: progress !== undefined ? `Загрузка ${progress}%` : 'Загрузка...',
      };
    case 'success':
      return {
        type: 'success',
        label: 'Загружено',
      };
    case 'error':
      return {
        type: 'error',
        label: 'Ошибка',
      };
    case 'idle':
    default:
      return {
        type: 'pending',
        label: 'Ожидание',
      };
  }
}

/* ============================================================================
 * 🎯 APP FILEUPLOADER
 * ========================================================================== */

const FileUploaderComponent = forwardRef<HTMLDivElement, AppFileUploaderProps>(
  function FileUploaderComponent(
    props: AppFileUploaderProps,
    ref: Ref<HTMLDivElement>,
  ): JSX.Element | null {
    const { telemetry, i18n } = useUnifiedUI();
    const { translate } = i18n;

    // Aria-label: i18n → обычный aria-label → undefined
    const ariaLabel = useMemo<string | undefined>(() => {
      if ('ariaLabelI18nKey' in props) {
        const effectiveNs = props.ariaLabelI18nNs ?? 'common';
        return translate(
          effectiveNs,
          props.ariaLabelI18nKey,
          props.ariaLabelI18nParams ?? EMPTY_PARAMS,
        );
      }
      return props['aria-label'];
    }, [props, translate]);

    // Деструктурируем все пропсы
    const {
      onFilesSelected,
      onFileRemove,
      onUploadStart,
      onUploadProgress,
      onUploadSuccess,
      onUploadError,
      uploadFile,
      validateFile: customValidateFile,
      multiple = false,
      accept,
      maxSize,
      maxFiles,
      disabled = false,
      buttonLabel = 'Выбрать файлы',
      dropZoneLabel = 'Перетащите файлы сюда или',
      dropZoneLabelActive = 'Отпустите файлы для загрузки',
      buttonAriaLabel,
      dropZoneAriaLabel,
      'data-testid': testId,
      ...restProps
    } = props;

    // Фильтруем бизнес-пропсы перед передачей в Core компонент
    const coreProps = omit(restProps, BUSINESS_PROPS);

    const policy = useFileUploaderPolicy(props);

    // Состояние файлов (внутреннее состояние App-слоя, единственный источник истины)
    const [files, setFiles] = useState<readonly InternalFileInfo[]>([]);

    // Отслеживание файлов, которые уже начали загружаться (для предотвращения повторных вызовов)
    const uploadingFilesRef = useRef<Set<string>>(new Set());

    // Drag state (управляется App-слоем)
    const [isDragActive, setIsDragActive] = useState<boolean>(false);
    const dragCounterRef = useRef<number>(0);

    // Генерация уникального ID для файла (production-grade)
    const generateFileId = useCallback((): string => {
      return crypto.randomUUID();
    }, []);

    // Конвертация InternalFileInfo в FileInfo для Core (discriminated union)
    // Адаптация domain-статуса в UI-статус Core компонента
    const internalToCoreFileInfo = useCallback((internal: InternalFileInfo): FileInfo => {
      const baseInfo = {
        id: internal.id,
        name: internal.file.name,
        sizeLabel: formatFileSize(internal.file.size),
        typeLabel: formatFileType(internal.file.type),
      };

      const appStatus = mapUploadStatusToFileStatus(internal.uploadStatus, internal.uploadProgress);

      // Discriminated union в зависимости от статуса
      switch (appStatus.type) {
        case 'progress':
          return {
            ...baseInfo,
            status: { type: 'progress' as const, label: appStatus.label },
            progress: internal.uploadProgress ?? 0,
          };
        case 'error':
          return {
            ...baseInfo,
            status: { type: 'error' as const, label: appStatus.label },
            errorMessage: internal.errorMessage ?? 'Неизвестная ошибка',
          };
        case 'success':
          return {
            ...baseInfo,
            status: { type: 'success' as const, label: appStatus.label },
          };
        case 'pending':
        default:
          return {
            ...baseInfo,
            status: { type: 'pending' as const, label: appStatus.label },
          };
      }
    }, []);

    /**
     * Отправка telemetry при ошибке валидации
     * Примечание: validation-error — это отдельная категория событий.
     * В отличие от других telemetry событий, здесь filesCount и totalSize
     * всегда равны 0, так как файл не был добавлен в state из-за ошибки валидации.
     * Это семантически корректно: валидация происходит до добавления файла.
     */
    const emitValidationErrorTelemetry = useCallback(
      (fileName: string, errorMessage?: string): void => {
        if (policy.telemetryEnabled) {
          const baseTelemetry = makeTelemetryBase(policy, files);
          emitFileUploaderTelemetry(telemetry, {
            ...baseTelemetry,
            action: FileUploaderTelemetryAction.UploadError,
            // Явно переопределяем для validation-error: файл не добавлен в state
            filesCount: 0,
            totalSize: 0,
            fileName,
            ...(errorMessage !== undefined ? { errorMessage } : {}),
          });
        }
      },
      [policy, files, telemetry],
    );

    // Валидация одного файла с telemetry
    const validateSingleFile = useCallback(
      async (file: File): Promise<File | null> => {
        // Базовая валидация
        const basicValidation = validateFileBasic(file, maxSize, accept);
        if (!basicValidation.valid) {
          emitValidationErrorTelemetry(file.name, basicValidation.error);
          return null;
        }

        // Кастомная валидация
        if (customValidateFile !== undefined) {
          const customValidation = await customValidateFile(file);
          if (!customValidation.valid) {
            emitValidationErrorTelemetry(file.name, customValidation.error);
            return null;
          }
        }

        return file;
      },
      [maxSize, accept, customValidateFile, emitValidationErrorTelemetry],
    );

    // Валидация файлов
    const validateFiles = useCallback(
      async (fileList: File[]): Promise<File[]> => {
        const validationResults = await Promise.all(
          fileList.map((file) => validateSingleFile(file)),
        );
        return validationResults.filter((file): file is File => file !== null);
      },
      [validateSingleFile],
    );

    // Загрузка файла
    const handleFileUpload = useCallback(
      async (fileId: string): Promise<void> => {
        if (uploadFile === undefined) return;

        // Получаем файл из state (единственный источник истины)
        const fileInfo = files.find((f) => f.id === fileId);
        if (fileInfo === undefined) return;

        const { file } = fileInfo;

        // Обновляем статус на uploading и отправляем telemetry (используем актуальное состояние)
        setFiles((prev) => {
          const updatedFiles = prev.map((f) =>
            f.id === fileId
              ? { ...f, uploadStatus: 'uploading' as UploadDomainStatus, uploadProgress: 0 }
              : f
          );

          // Telemetry: начало загрузки (используем актуальное состояние из setFiles)
          if (policy.telemetryEnabled) {
            const baseTelemetry = makeTelemetryBase(policy, updatedFiles);
            emitFileUploaderTelemetry(telemetry, {
              ...baseTelemetry,
              action: FileUploaderTelemetryAction.UploadStart,
              totalSize: file.size,
              fileName: file.name,
              fileType: file.type,
            });
          }

          return updatedFiles;
        });

        onUploadStart?.(fileId, file);

        try {
          const response = await uploadFile(file, (progress: number) => {
            // Обновляем прогресс и отправляем telemetry
            setFiles((prev) => {
              const updatedFiles = prev.map((f) =>
                f.id === fileId ? { ...f, uploadProgress: progress } : f
              );

              // Telemetry: прогресс (используем актуальное состояние)
              if (policy.telemetryEnabled) {
                const baseTelemetry = makeTelemetryBase(policy, updatedFiles);
                emitFileUploaderTelemetry(telemetry, {
                  ...baseTelemetry,
                  action: FileUploaderTelemetryAction.UploadProgress,
                  totalSize: file.size,
                  fileName: file.name,
                  uploadProgress: progress,
                });
              }

              return updatedFiles;
            });

            onUploadProgress?.(fileId, progress);
          });

          // Успешная загрузка
          setFiles((prev) => {
            const updatedFiles = prev.map((f) =>
              f.id === fileId
                ? { ...f, uploadStatus: 'success' as UploadDomainStatus, uploadProgress: 100 }
                : f
            );

            // Telemetry: успех (используем актуальное состояние)
            if (policy.telemetryEnabled) {
              const baseTelemetry = makeTelemetryBase(policy, updatedFiles);
              emitFileUploaderTelemetry(telemetry, {
                ...baseTelemetry,
                action: FileUploaderTelemetryAction.UploadSuccess,
                totalSize: file.size,
                fileName: file.name,
              });
            }

            return updatedFiles;
          });

          onUploadSuccess?.(fileId, response);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';

          // Ошибка загрузки
          setFiles((prev) => {
            const updatedFiles = prev.map((f) =>
              f.id === fileId
                ? {
                  ...f,
                  uploadStatus: 'error' as UploadDomainStatus,
                  errorMessage,
                }
                : f
            );

            // Telemetry: ошибка (используем актуальное состояние)
            if (policy.telemetryEnabled) {
              const baseTelemetry = makeTelemetryBase(policy, updatedFiles);
              emitFileUploaderTelemetry(telemetry, {
                ...baseTelemetry,
                action: FileUploaderTelemetryAction.UploadError,
                totalSize: file.size,
                fileName: file.name,
                errorMessage,
              });
            }

            return updatedFiles;
          });

          onUploadError?.(fileId, error instanceof Error ? error : new Error(errorMessage));
        }
      },
      [
        uploadFile,
        policy,
        files,
        onUploadStart,
        onUploadProgress,
        onUploadSuccess,
        onUploadError,
        telemetry,
      ],
    );

    // Обработка выбранных файлов
    const handleFilesSelected = useCallback(
      async (
        selectedFiles: File[],
        telemetryAction: FileUploaderTelemetryAction = FileUploaderTelemetryAction.Select,
      ): Promise<void> => {
        // Проверка максимального количества файлов
        const currentFilesCount = files.length;
        let filesToProcess = selectedFiles;
        if (maxFiles !== undefined && currentFilesCount + selectedFiles.length > maxFiles) {
          const allowedCount = maxFiles - currentFilesCount;
          if (allowedCount <= 0) {
            if (policy.telemetryEnabled) {
              const baseTelemetry = makeTelemetryBase(policy, files);
              emitFileUploaderTelemetry(telemetry, {
                ...baseTelemetry,
                action: FileUploaderTelemetryAction.UploadError,
                errorMessage: `Достигнут лимит файлов: ${maxFiles}`,
              });
            }
            return;
          }
          filesToProcess = selectedFiles.slice(0, allowedCount);
        }

        // Валидация файлов
        const validatedFiles = await validateFiles(filesToProcess);
        if (validatedFiles.length === 0) return;

        // Конвертация в InternalFileInfo (единственный источник истины)
        const newFileInfos: InternalFileInfo[] = validatedFiles.map((file) => ({
          id: generateFileId(),
          file,
          uploadStatus: 'idle' as UploadDomainStatus,
        }));

        // Обновление состояния
        setFiles((prev) => {
          const updatedFiles = [...prev, ...newFileInfos];

          // Telemetry (используем актуальное состояние)
          if (policy.telemetryEnabled) {
            const baseTelemetry = makeTelemetryBase(policy, updatedFiles);
            emitFileUploaderTelemetry(telemetry, {
              ...baseTelemetry,
              action: telemetryAction,
            });
          }

          return updatedFiles;
        });

        // Callback
        onFilesSelected?.(validatedFiles);

        // Автоматическая загрузка будет запущена через useEffect после обновления состояния
      },
      [
        files,
        maxFiles,
        validateFiles,
        generateFileId,
        policy,
        onFilesSelected,
        telemetry,
      ],
    );

    // Обработчик выбора файлов через input
    const handleChange = useCallback(
      (selectedFiles: File[]): void => {
        handleFilesSelected(selectedFiles, FileUploaderTelemetryAction.Select).catch(() => {
          // Ошибка обрабатывается внутри handleFilesSelected
        });
      },
      [handleFilesSelected],
    );

    // Обработчик drop файлов
    const handleDrop = useCallback(
      (droppedFiles: File[]): void => {
        setIsDragActive(false);

        dragCounterRef.current = 0;
        handleFilesSelected(droppedFiles, FileUploaderTelemetryAction.Drop).catch(() => {
          // Ошибка обрабатывается внутри handleFilesSelected
        });
      },
      [handleFilesSelected],
    );

    // Обработчик drag enter
    const handleDragEnter = useCallback((event: DragEvent<HTMLDivElement>): void => {
      event.preventDefault();
      event.stopPropagation();

      const newCounter = dragCounterRef.current + 1;

      dragCounterRef.current = newCounter;
      if (newCounter === 1) {
        setIsDragActive(true);
      }
    }, []);

    // Обработчик drag leave
    const handleDragLeave = useCallback((event: DragEvent<HTMLDivElement>): void => {
      event.preventDefault();
      event.stopPropagation();

      const newCounter = dragCounterRef.current - 1;

      dragCounterRef.current = newCounter;
      if (newCounter === 0) {
        setIsDragActive(false);
      }
    }, []);

    // Обработчик drag over
    const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>): void => {
      event.preventDefault();
      event.stopPropagation();
    }, []);

    // Обработчик удаления файла
    const handleRemove = useCallback(
      (fileId: string): void => {
        // Получаем файл из state перед удалением
        const fileToRemove = files.find((f) => f.id === fileId);

        setFiles((prev) => {
          const updatedFiles = prev.filter((f) => f.id !== fileId);

          // Telemetry (используем актуальное состояние после удаления)
          if (policy.telemetryEnabled) {
            const baseTelemetry = makeTelemetryBase(policy, updatedFiles);
            emitFileUploaderTelemetry(telemetry, {
              ...baseTelemetry,
              action: FileUploaderTelemetryAction.Remove,
              ...(fileToRemove?.file.name !== undefined
                ? { fileName: fileToRemove.file.name }
                : {}),
            });
          }

          return updatedFiles;
        });

        onFileRemove?.(fileId);
      },
      [policy, files, onFileRemove, telemetry],
    );

    /**
     * Lifecycle telemetry фиксирует состояние policy на момент первого рендера.
     * Не реагирует на последующие изменения props или policy.
     * Это архитектурная гарантия.
     */
    const lifecyclePayloadRef = useRef<
      {
        mount: FileUploaderTelemetryPayload;
        unmount: FileUploaderTelemetryPayload;
      } | undefined
    >(undefined);

    lifecyclePayloadRef.current ??= {
      mount: {
        ...makeTelemetryBase(policy, files),
        action: FileUploaderTelemetryAction.Mount,
      },
      unmount: {
        ...makeTelemetryBase(policy, files),
        action: FileUploaderTelemetryAction.Unmount,
      },
    };

    const lifecyclePayload = lifecyclePayloadRef.current;

    /** Telemetry lifecycle */
    useEffect(() => {
      if (!policy.telemetryEnabled) return;

      emitFileUploaderTelemetry(telemetry, lifecyclePayload.mount);
      return (): void => {
        emitFileUploaderTelemetry(telemetry, lifecyclePayload.unmount);
      };
    }, [policy.telemetryEnabled, lifecyclePayload, telemetry]);

    /** Автоматическая загрузка файлов со статусом 'idle' */
    useEffect(() => {
      if (uploadFile === undefined) return;

      const idleFiles = files.filter(
        (f) => f.uploadStatus === 'idle' && !uploadingFilesRef.current.has(f.id),
      );
      for (const fileInfo of idleFiles) {
        uploadingFilesRef.current.add(fileInfo.id);
        handleFileUpload(fileInfo.id).catch(() => {
          // Ошибка обрабатывается внутри handleFileUpload
        });
      }
    }, [files, uploadFile, handleFileUpload]);

    // Конвертация внутренних файлов в FileInfo для Core
    const coreFiles: readonly FileInfo[] = useMemo(() => {
      return files.map(internalToCoreFileInfo);
    }, [files, internalToCoreFileInfo]);

    // Форматирование hint
    const hint = useMemo(() => formatHint(maxSize, maxFiles), [maxSize, maxFiles]);

    const coreFileUploaderProps = useMemo((): CoreFileUploaderProps => ({
      files: coreFiles,
      multiple,
      accept,
      disabled,
      isDragActive,
      buttonLabel,
      dropZoneLabel,
      dropZoneLabelActive,
      hint,
      onChange: (files: File[]) => {
        handleChange(files);
      },
      onDrop: (files: File[]) => {
        handleDrop(files);
      },
      onRemove: (fileId: string) => {
        handleRemove(fileId);
      },
      onDragEnter: handleDragEnter,
      onDragLeave: handleDragLeave,
      onDragOver: handleDragOver,
      'aria-label': ariaLabel,
      buttonAriaLabel,
      dropZoneAriaLabel,
      'data-component': 'AppFileUploader',
      'data-state': policy.isRendered ? 'visible' : 'hidden',
      'data-feature-flag': policy.hiddenByFeatureFlag ? 'hidden' : 'visible',
      'data-telemetry': policy.telemetryEnabled ? 'enabled' : 'disabled',
      'data-testid': testId ?? 'core-file-uploader',
      ...coreProps,
    } as CoreFileUploaderProps), [
      coreFiles,
      multiple,
      accept,
      disabled,
      isDragActive,
      buttonLabel,
      dropZoneLabel,
      dropZoneLabelActive,
      hint,
      handleChange,
      handleDrop,
      handleRemove,
      handleDragEnter,
      handleDragLeave,
      handleDragOver,
      ariaLabel,
      buttonAriaLabel,
      dropZoneAriaLabel,
      policy.isRendered,
      policy.hiddenByFeatureFlag,
      policy.telemetryEnabled,
      testId,
      coreProps,
    ]);

    /** Policy: hidden */
    if (!policy.isRendered) return null;

    return (
      <CoreFileUploader
        ref={ref}
        {...coreFileUploaderProps}
      />
    );
  },
);

/**
 * UI-контракт FileUploader компонента.
 * @contract
 * Гарантируется:
 * - Детерминированный рендеринг без side effects (кроме telemetry)
 * - SSR-safe и concurrent rendering compatible
 * - Полная интеграция с централизованной telemetry системой
 * - Управление feature flags для скрытия FileUploader
 * - Корректная обработка accessibility (keyboard navigation, ARIA)
 * - Валидация файлов (размер, тип, количество)
 * - Управление состоянием загрузки
 * - Поддержка drag-and-drop
 * - Форматирование данных (размер, тип, hint)
 * Инварианты:
 * - Файлы корректно валидируются перед добавлением
 * - Состояние загрузки корректно отображается
 * - Telemetry payload содержит корректные значения
 * - Telemetry отражает состояние policy, а не сырые props
 * - visible/hidden в payload являются производными только от policy
 * - Drag state управляется App-слоем
 * Не допускается:
 * - Использование напрямую core FileUploader компонента
 * - Игнорирование feature flag логики
 * - Нарушение keyboard navigation контрактов
 * - Модификация telemetry payload структуры
 * - Использование props.visible напрямую вне policy
 */
export const FileUploader = Object.assign(
  memo(FileUploaderComponent) as typeof FileUploaderComponent,
  {
    displayName: 'FileUploader',
  },
);
