import { join } from 'path';
import { createWriteStream } from 'fs'; //para crear un stream de escritura
import { v4 as uuidv4 } from 'uuid';
import {
  type FileUpload,
} from 'graphql-upload/GraphQLUpload.mjs';

export async function storeImageAndGetUrl(file: FileUpload) {
  const { createReadStream, filename } = file;
  const uniqueFilename = `${uuidv4()}_${filename}`;
  const path = join(process.cwd(), 'public', uniqueFilename);
  const imageUrl = `${process.env.APP_URL}/${uniqueFilename}`;
  const stream = createReadStream();
  const out = createWriteStream(path);
  stream.pipe(out);
  return imageUrl;
}
