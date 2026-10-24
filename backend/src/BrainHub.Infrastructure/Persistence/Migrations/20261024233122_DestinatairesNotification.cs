using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BrainHub.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class DestinatairesNotification : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "destinataire_notification",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Email = table.Column<string>(type: "character varying(254)", maxLength: 254, nullable: false),
                    Libelle = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    DateAjout = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_destinataire_notification", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_destinataire_notification_Email",
                table: "destinataire_notification",
                column: "Email",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "destinataire_notification");
        }
    }
}
