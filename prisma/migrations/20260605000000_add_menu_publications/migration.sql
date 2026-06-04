-- CreateTable
CREATE TABLE "menu_publications" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "notes" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "menu_publications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "menu_publications_date_key" ON "menu_publications"("date");

-- CreateTable
CREATE TABLE "menu_publication_items" (
    "publicationId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "menu_publication_items_pkey" PRIMARY KEY ("publicationId", "menuItemId")
);

ALTER TABLE "menu_publication_items" ADD CONSTRAINT "menu_publication_items_publicationId_fkey"
  FOREIGN KEY ("publicationId") REFERENCES "menu_publications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "menu_publication_items" ADD CONSTRAINT "menu_publication_items_menuItemId_fkey"
  FOREIGN KEY ("menuItemId") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
