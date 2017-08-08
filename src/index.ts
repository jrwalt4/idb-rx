import { Observable, Observer } from 'rxjs';

let idbFactory: IDBFactory;

export function open(
  name: string,
  version?: number,
  onUpgrade?: ( db: IDBDatabase ) => void
): Observable<ODBDatabaseWrapper> {
  return Observable.create(( obs: Observer<ODBDatabaseWrapper> ) => {
    let openRequest = getFactory().open( name, version );
    openRequest.onupgradeneeded = () => onUpgrade && onUpgrade( openRequest.result as IDBDatabase );
    openRequest.onerror = console.error.bind( console );
    openRequest.onsuccess = () => {
      obs.next( new ODBDatabaseWrapper( openRequest.result ) );
      obs.complete();
    };
  } );
}

export class ODBDatabaseWrapper {
  constructor( public db: IDBDatabase ) { }
  public transaction( objectStores: string[], mode: IDBTransactionMode ) {
    return new ODBTransactionWrapper( this.db.transaction( objectStores, mode ) );
  }
}

export class ODBTransactionWrapper {
  constructor( public transaction: IDBTransaction ) { }
  public objectStore( name: string ) {
    return new ODBObjectStoreWrapper( this.transaction.objectStore( name ) );
  }
}

export class ODBObjectStoreWrapper {
  constructor( public objectStore: IDBObjectStore ) { }
  get indexNames() {
    return this.objectStore.indexNames;
  }
  get keyPath() {
    return this.objectStore.keyPath;
  }
  get name() {
    return this.objectStore.name;
  }
  get transaction() {
    return new ODBTransactionWrapper( this.objectStore.transaction );
  }
  public openCursor( range?: IDBKeyRange, direction?: IDBCursorDirection ) {
    return Observable.create(( observer: Observer<ODBCursorWithValue> ) => {
      let cursorRequest = this.objectStore.openCursor( range, direction );
      cursorRequest.onsuccess = ( cursorEvent ) => {
        let cursor = cursorRequest.result as IDBCursorWithValue;
        if ( cursor && !observer.closed ) {
          observer.next( cursor );
          cursor.continue();
        } else {
          observer.complete();
        }
      };
      cursorRequest.onerror = ( err ) => {
        observer.error( cursorRequest.error );
      };
    } );
  }
}

export interface ODBCursorWithValue<K= {}, V= {}, PK= {}> {
  key: K;
  primaryKey: PK;
  value: V;
}

export function setFactory( customFactory: IDBFactory ) {
  idbFactory = customFactory;
}

function getFactory(): IDBFactory {
  return idbFactory || ( init() && idbFactory );
}

function init(): boolean {
  idbFactory = idbFactory || window.indexedDB;
  if ( idbFactory ) {
    return true;
  }
  return false;
}
