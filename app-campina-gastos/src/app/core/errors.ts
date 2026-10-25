export function errorMessage(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error && 'message' in error
        ? String(error.message)
        : '';
  if (/revision|actualizad|conflict/i.test(message))
    return 'Otra persona actualizó este mes. Actualiza la página antes de guardar tus cambios.';
  if (/cerrado/i.test(message)) return 'Este mes está cerrado y sus importes están protegidos.';
  if (/permission|permis|autoriz|JWT|session/i.test(message))
    return 'No tienes permiso para realizar esta acción. Revisa tu acceso al hogar.';
  if (/fetch|network|connection/i.test(message))
    return 'No pudimos conectar. Revisa tu conexión e inténtalo otra vez.';
  if (/rate|seconds|limit|429/i.test(message))
    return 'Espera un minuto antes de volver a solicitar un correo.';
  if (/token|otp|expired|invalid.*code/i.test(message))
    return 'El código o enlace no es válido o ya venció. Solicita uno nuevo.';
  if (/correction_pending_receipt_idx/i.test(message))
    return 'Este recibo ya tiene una corrección pendiente de revisión.';
  if (/invitation_pending_email_idx/i.test(message))
    return 'Este correo ya tiene una invitación pendiente. Revisa su estado antes de reenviar.';
  if (/duplic|unique|ya existe/i.test(message))
    return 'Este servicio ya tiene un recibo este mes. Abre el existente para editarlo.';
  if (
    /aporte|importe|archivo|recibo|periodo|habilitado|cuenta|datos|grupo|motivo|completo|invitaci[oó]n|solicitud|administrador|acceso|SMTP/i.test(
      message,
    ) &&
    message.length < 220
  )
    return message;
  return 'No pudimos completar la operación. Inténtalo de nuevo.';
}
