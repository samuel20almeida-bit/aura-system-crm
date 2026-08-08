-- O teto de 25 MB dos anexos só existia no cliente (Attachments.tsx), onde
-- qualquer um que fale HTTP com o storage passa por cima dele. Passa a valer no
-- bucket: 25 MiB = 26214400 bytes.
update storage.buckets set file_size_limit = 26214400 where id = 'task-attachments';
