import React from 'react';
import { Modal } from 'antd';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
}) => {
  return (
    <Modal
      open={isOpen}
      title={title}
      onOk={onConfirm}
      onCancel={onClose}
      okText="Confirm"
      cancelText="Cancel"
      okButtonProps={{ danger: true }}
    >
      <p>{message}</p>
    </Modal>
  );
};
