require("dotenv").config();
import { NotionAdapter } from "../adapters";
import { GroupedClipping } from "../interfaces";
import { CreatePageParams, Emoji, BlockType } from "../interfaces";
import {
  makeHighlightsBlocks,
  updateSync,
  getUnsyncedHighlights,
  makeBlocks,
} from "../utils";

export class Notion {
  private notion;

  constructor() {
    this.notion = new NotionAdapter();
  }

  /* Method to get Notion block id of the Notion page given the book name */
  getIdFromBookName = async (bookName: string) => {
    const response = await this.notion.queryDatabase({
      database_id: process.env.BOOK_DB_ID as string,
      filter: {
        or: [
          {
            property: "Book Name",
            text: {
              equals: bookName,
            },
          },
        ],
      },
    });
    const [book] = response.results;
    if (book) {
      return book.id;
    } else {
      return null;
    }
  };

  /* Method to sync highlights to notion */
  syncHighlights = async (books: GroupedClipping[]) => {
    try {
      // get unsynced highlights from each book
      const unsyncedBooks = getUnsyncedHighlights(books);
      // if unsynced books are present
      if (unsyncedBooks.length > 0) {
        console.log("\nš Syncing highlights to Notion");
        for (const book of unsyncedBooks) {
          console.log(`\nš Syncing book: ${book.title}`);
          const bookId = await this.getIdFromBookName(book.title);
          // if the book is already present in Notion
          if (bookId) {
            console.log(`š Book already present, appending highlights`);
            // append unsynced highlights at the end of the page
            await this.notion.appendBlockChildren(
              bookId,
              makeBlocks(book.highlights, BlockType.quote, book)
            );
          } else {
            console.log(`š Book not present, creating notion page`);
            const createPageParams: CreatePageParams = {
              parentDatabaseId: process.env.BOOK_DB_ID as string,
              properties: {
                title: book.title,
                author: book.author,
                bookName: book.title,
              },
              children: makeHighlightsBlocks(book.highlights, BlockType.quote, book),
              icon: Emoji["š"],
            };
            // if the book page doesn't exist in notion, create a new notion page for the book
            await this.notion.createPage(createPageParams);
          }
          // after each book is successfully synced, update the sync metadata (cache)
          updateSync(book);
        }
        console.log("\nā Successfully synced highlights to Notion");
      } else {
        console.log("š¢ Every book is already synced!");
      }
    } catch (error: unknown) {
      console.error("ā Failed to sync highlights", error);
      throw error;
    } finally {
      console.log("--------------------------------------");
    }
  };
}
